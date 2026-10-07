import { createApp, createRouter, eventHandler, readBody, toWebHandler } from "h3";
import { describe, expect, it, vi } from "vitest";

vi.mock("vike", async () => {
  const { enhance } = await import("@universal-middleware/core");
  return {
    // Stands for the user's +middleware: it puts the `x-user` header in the context, after `x-delay` milliseconds
    getUniversalMiddlewares: () => [
      enhance(
        async (request: Request, context: Universal.Context) => {
          await new Promise((resolve) => setTimeout(resolve, Number(request.headers.get("x-delay") ?? 0)));
          return { ...context, user: request.headers.get("x-user") };
        },
        { name: "stub:middleware" },
      ),
    ],
    // Stands for Vike's pages
    universalHandler: enhance(async (request: Request) => new Response(`page ${new URL(request.url).pathname}`), {
      name: "stub:pages",
      method: ["GET", "POST"],
      path: "/**",
      immutable: true,
    }),
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

  const get = (app: ReturnType<typeof createApp>, path: string, headers: Record<string, string> = {}) =>
    toWebHandler(app)(new Request(`http://localhost${path}`, { headers }));
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

    const response = await get(app, "/api/me", { "x-user": "alice" });
    expect(await response.json()).toEqual({ user: "alice" });
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
      get(app, "/api/me", { "x-user": "slow", "x-delay": "30" }),
      get(app, "/api/me", { "x-user": "fast" }),
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

    expect(await (await get(app, "/about")).text()).toBe("page /about");
  });

  it("answers with the app's route when a page has the same path", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).get(
      "/about",
      eventHandler(() => "app"),
    );

    expect(await (await get(app, "/about")).text()).toBe("app");
  });

  it("hands a JSON body to a route registered after vike(app)", async () => {
    const app = createApp();
    vike(app);
    routerApp(app).post(
      "/api/echo",
      eventHandler((event) => readBody(event)),
    );

    const response = await toWebHandler(app)(
      new Request("http://localhost/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ a: 1 }),
      }),
    );
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

    const response = await toWebHandler(app)(new Request("http://localhost/api/me", { method: "HEAD" }));
    expect(response.status).toBe(200);
  });

  it("appends the pages once, at the first request", async () => {
    const app = createApp();
    vike(app);
    const layers = app.stack.length;

    await get(app, "/about");
    expect(app.stack.length).toBe(layers + 1);
    await get(app, "/about");
    expect(app.stack.length).toBe(layers + 1);
  });

  it("does not render a page for a method Vike's handler does not declare", async () => {
    const app = createApp();
    vike(app);

    const response = await toWebHandler(app)(new Request("http://localhost/about", { method: "DELETE" }));
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("page");
  });

  it("keeps the app's own onRequest", async () => {
    const onRequest = vi.fn();
    const app = createApp({ onRequest });
    vike(app);

    await get(app, "/about");
    await get(app, "/about");
    expect(onRequest).toHaveBeenCalledTimes(2);
  });

  it("throws when vike(app) is called twice on the same app", () => {
    const app = createApp();
    vike(app);
    expect(() => vike(app)).toThrow(/already called/);
  });
});
