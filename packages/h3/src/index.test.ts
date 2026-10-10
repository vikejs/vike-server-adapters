import { createApp, createRouter, eventHandler, readBody, toWebHandler } from "h3";
import { describe, expect, it, vi } from "vitest";

// Stands for the two halves of Vike's +middleware that vike(app) applies: the ones that aren't handlers, looked up upon each request, and the handlers with the pages. Here: the user's
// +middleware puts the `x-user` header in the context, after `x-delay` milliseconds, and with an `x-step` header it also adds a response step that sets `x-step` on the response
vi.mock("vike/__internal", async () => {
  const { enhance } = await import("@universal-middleware/core");
  return {
    middlewaresBeforeRoutes: enhance(
      async (request: Request, context: Universal.Context) => {
        await new Promise((resolve) => setTimeout(resolve, Number(request.headers.get("x-delay") ?? 0)));
        // Like the real one, it adds to the context and returns nothing or a response step
        Object.assign(context, { user: request.headers.get("x-user") });
        if (!request.headers.has("x-step")) return;
        return (response: Response) => {
          response.headers.set("x-step", "applied");
          return response;
        };
      },
      { name: "stub:before" },
    ),
    // Stands for the +middleware that are handlers (here /x), then Vike's pages: like the real one, it declares every method and answers 404 for a method the pages don't declare
    middlewaresAfterRoutes: enhance(
      async (request: Request) => {
        const { pathname } = new URL(request.url);
        if (!["GET", "POST", "PUT", "PATCH", "HEAD", "OPTIONS"].includes(request.method)) {
          return new Response("Not Found", { status: 404 });
        }
        return new Response(request.method === "GET" && pathname === "/x" ? "handler" : `page ${pathname}`);
      },
      {
        name: "stub:after",
        method: ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "CONNECT", "TRACE"],
        path: "/**",
      },
    ),
  };
});

import vike, { apply, getContext } from "./index.js";

describe("@vikejs/h3", () => {
  it("vike is a function", () => {
    expect(vike).toBeTypeOf("function");
  });

  it("apply is a function", () => {
    expect(apply).toBeTypeOf("function");
  });

  const send = (app: ReturnType<typeof createApp>, path: string, init?: RequestInit) =>
    toWebHandler(app)(new Request(`http://localhost${path}`, init));
  const routerApp = (app: ReturnType<typeof createApp>) => {
    const router = createRouter();
    app.use(router);
    return router;
  };

  it("runs the +middleware before a route registered after vike(app), and the route sees the context", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).get(
      "/api/me",
      eventHandler((event) => ({ user: (getContext(event) as { user: string }).user })),
    );

    const response = await send(app, "/api/me", { headers: { "x-user": "alice" } });
    expect(await response.json()).toEqual({ user: "alice" });
  });

  it("answers 200 JSON from a route that returns an object, with the response step of the +middleware applied", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).get(
      "/api/me",
      eventHandler((event) => ({ user: (getContext(event) as { user: string }).user })),
    );

    const response = await send(app, "/api/me", { headers: { "x-user": "alice", "x-step": "1" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-step")).toBe("applied");
    expect(await response.json()).toEqual({ user: "alice" });
  });

  it("answers with a +middleware that is a handler where the app has no route", async () => {
    const app = createApp();
    vike(app);
    expect(await (await send(app, "/x")).text()).toBe("handler");
  });

  it("answers with the app's route when a +middleware that is a handler has the same path", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).get(
      "/x",
      eventHandler(() => "app"),
    );
    expect(await (await send(app, "/x")).text()).toBe("app");
  });

  it("applies the response step of the +middleware to the response of a route registered after vike(app), and of a page", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).get(
      "/api/me",
      eventHandler(() => "api"),
    );

    for (const path of ["/api/me", "/about"]) {
      expect((await send(app, path, { headers: { "x-step": "1" } })).headers.get("x-step")).toBe("applied");
    }
    expect((await send(app, "/api/me")).headers.get("x-step")).toBe(null);
  });

  it("keeps the context of concurrent requests apart", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).get(
      "/api/me",
      eventHandler(async (event) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return (getContext(event) as { user: string }).user;
      }),
    );

    const [slow, fast] = await Promise.all([
      send(app, "/api/me", { headers: { "x-user": "slow", "x-delay": "30" } }),
      send(app, "/api/me", { headers: { "x-user": "fast" } }),
    ]);
    expect([await slow.text(), await fast.text()]).toEqual(["slow", "fast"]);
  });

  it("renders a page after the app's routes", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).get(
      "/api/me",
      eventHandler(() => "api"),
    );

    expect(await (await send(app, "/about")).text()).toBe("page /about");
  });

  it("answers with the app's route when a page has the same path", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).get(
      "/about",
      eventHandler(() => "app"),
    );

    expect(await (await send(app, "/about")).text()).toBe("app");
  });

  it("hands a JSON body to a route registered after vike(app)", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).post(
      "/api/echo",
      eventHandler((event) => readBody(event)),
    );

    const response = await send(app, "/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(await response.json()).toEqual({ a: 1 });
  });

  it("answers HEAD on a route registered after vike(app)", async () => {
    const app = createApp();
    vike(app);
    // h3's router answers HEAD with 404 for a `get` route, so the route answers every method
    app.use(
      "/api/me",
      eventHandler(() => "api"),
    );

    const response = await send(app, "/api/me", { method: "HEAD" });
    expect(response.status).toBe(200);
  });

  it("appends the pages once, at the first request", async () => {
    const app = createApp();
    vike(app);
    const before = app.stack.length;

    await send(app, "/about");
    const after = app.stack.length;
    expect(after).toBeGreaterThan(before);
    await send(app, "/about");
    expect(app.stack.length).toBe(after);
  });

  it("answers Vike's 404 for DELETE, which Vike's pages don't declare", async () => {
    const app = createApp();
    vike(app);

    const response = await send(app, "/about", { method: "DELETE" });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("keeps the app's own onRequest", async () => {
    const onRequest = vi.fn();
    const app = createApp({ onRequest });
    vike(app);

    await send(app, "/about");
    await send(app, "/about");
    expect(onRequest).toHaveBeenCalledTimes(2);
  });

  it("throws when vike(app) is called twice on the same app", () => {
    const app = createApp();
    vike(app);
    expect(() => vike(app)).toThrow(/already called/);
  });
});
