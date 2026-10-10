import { createRouter } from "@hattip/router";
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
    // Stands for the +middleware that are handlers (here /x), then Vike's pages: like the real one, it declares every method and answers nothing for a method the pages don't declare
    middlewaresAfterRoutes: enhance(
      async (request: Request) => {
        const { pathname } = new URL(request.url);
        if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(request.method)) return;
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

describe("@vikejs/hattip", () => {
  it("vike is a function", () => {
    expect(vike).toBeTypeOf("function");
  });

  it("apply is a function", () => {
    expect(apply).toBeTypeOf("function");
  });

  const send = (
    handler: ReturnType<ReturnType<typeof createRouter>["buildHandler"]>,
    path: string,
    init?: RequestInit,
  ) => {
    const request = new Request(`http://localhost${path}`, init);
    // biome-ignore lint/suspicious/noExplicitAny: a minimal HatTip context
    return handler({ request, url: new URL(request.url), method: request.method } as any);
  };
  const user = (context: unknown) => (getContext(context as Parameters<typeof getContext>[0]) as { user: string }).user;

  it("runs the +middleware before a route registered after vike(app), and the route sees the context", async () => {
    const router = createRouter();
    vike(router);
    router.get("/api/me", (context) => Response.json({ user: user(context) }));

    const response = await send(router.buildHandler(), "/api/me", { headers: { "x-user": "alice" } });
    expect(await response?.json()).toEqual({ user: "alice" });
  });

  it("answers with a +middleware that is a handler where the app has no route", async () => {
    const router = createRouter();
    vike(router);
    expect(await (await send(router.buildHandler(), "/x"))?.text()).toBe("handler");
  });

  it("answers with the app's route when a +middleware that is a handler has the same path", async () => {
    const router = createRouter();
    vike(router);
    router.get("/x", () => new Response("app"));
    expect(await (await send(router.buildHandler(), "/x"))?.text()).toBe("app");
  });

  it("applies the response step of the +middleware to the response of a route registered after vike(app), and of a page", async () => {
    const router = createRouter();
    vike(router);
    router.get("/api/me", () => new Response("api"));
    const handler = router.buildHandler();

    for (const path of ["/api/me", "/about"]) {
      expect((await send(handler, path, { headers: { "x-step": "1" } }))?.headers.get("x-step")).toBe("applied");
    }
    expect((await send(handler, "/api/me"))?.headers.get("x-step")).toBe(null);
  });

  it("keeps the context of concurrent requests apart", async () => {
    const router = createRouter();
    vike(router);
    router.get("/api/me", async (context) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(user(context));
    });

    const handler = router.buildHandler();
    const [slow, fast] = await Promise.all([
      send(handler, "/api/me", { headers: { "x-user": "slow", "x-delay": "30" } }),
      send(handler, "/api/me", { headers: { "x-user": "fast" } }),
    ]);
    expect([await slow?.text(), await fast?.text()]).toEqual(["slow", "fast"]);
  });

  it("renders a page after the app's routes", async () => {
    const router = createRouter();
    vike(router);
    router.get("/api/me", () => new Response("api"));

    expect(await (await send(router.buildHandler(), "/about"))?.text()).toBe("page /about");
  });

  it("answers with the app's route when a page has the same path", async () => {
    const router = createRouter();
    vike(router);
    router.get("/about", () => new Response("app"));

    expect(await (await send(router.buildHandler(), "/about"))?.text()).toBe("app");
  });

  it("hands a JSON body to a route registered after vike(app)", async () => {
    const router = createRouter();
    vike(router);
    router.post("/api/echo", async (context) => Response.json(await context.request.json()));

    const response = await send(router.buildHandler(), "/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(await response?.json()).toEqual({ a: 1 });
  });

  it("answers HEAD on a route registered after vike(app)", async () => {
    const router = createRouter();
    vike(router);
    // HatTip's router doesn't match HEAD to a `get` route, so the route answers every method
    router.use("/api/me", () => new Response("api"));

    const response = await send(router.buildHandler(), "/api/me", { method: "HEAD" });
    expect(response?.status).toBe(200);
  });

  it("passes DELETE on to Vike's handler", async () => {
    const router = createRouter();
    vike(router);

    const response = await send(router.buildHandler(), "/about", { method: "DELETE" });
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("page /about");
  });

  it("throws when vike(app) is called twice on the same app", () => {
    const router = createRouter();
    vike(router);
    expect(() => vike(router)).toThrow(/already called/);
  });
});
