import { Elysia } from "elysia";
import { serve } from "srvx";
import { describe, expect, it, vi } from "vitest";

// Stands for the proxy of Vike's +middleware that vike(app) applies: one element for the ones that aren't handlers, which looks the list up upon each request, one for the handlers with the pages. Here: the user's
// +middleware puts the `x-user` header in the context, after `x-delay` milliseconds, and with an `x-step` header it also adds a response step that sets `x-step` on the response
vi.mock("vike/__internal", async () => {
  const { enhance } = await import("@universal-middleware/core");
  return {
    plusMiddlewareProxy: [
      Object.assign(
        enhance(
          async (request: Request, context: Universal.Context) => {
            await new Promise((resolve) => setTimeout(resolve, Number(request.headers.get("x-delay") ?? 0)));
            if (request.headers.has("x-step")) {
              // A middleware returns a context or a response step, not both: with a response step, it mutates the context
              Object.assign(context, { user: request.headers.get("x-user") });
              return (response: Response) => {
                response.headers.set("x-step", "applied");
                return response;
              };
            }
            return { ...context, user: request.headers.get("x-user") };
          },
          { name: "stub:proxy" },
        ),
        { isHandler: false },
      ),
      // Stands for Vike's pages: like the real one, it declares every method, first runs the +middleware that are handlers (here /x), answers 404 for a method the pages don't serve, then renders the page
      Object.assign(
        enhance(
          async (request: Request) => {
            const { pathname } = new URL(request.url);
            if (!["GET", "HEAD", "POST", "PUT", "OPTIONS", "PATCH"].includes(request.method)) {
              return new Response("Not Found", { status: 404 });
            }
            return new Response(request.method === "GET" && pathname === "/x" ? "handler" : `page ${pathname}`);
          },
          {
            name: "stub:pages",
            method: ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "CONNECT", "TRACE"],
            path: "/**",
            immutable: true,
          },
        ),
        { isHandler: true },
      ),
    ],
  };
});

import vike, { apply } from "./index.js";

describe("@vikejs/elysia", () => {
  it("vike is a function", () => {
    expect(vike).toBeTypeOf("function");
  });

  it("apply is a function", () => {
    expect(apply).toBeTypeOf("function");
  });

  const send = (app: Elysia, path: string, init?: RequestInit) =>
    app.handle(new Request(`http://localhost${path}`, init));

  it("runs the +middleware before a route registered after vike(app), and the route sees the context", async () => {
    const app = new Elysia();
    vike(app);
    // @ts-expect-error getContext() is derived by the +middleware's plugin
    app.get("/api/me", ({ getContext }) => ({ user: getContext().user }));

    const response = await send(app, "/api/me", { headers: { "x-user": "alice" } });
    expect(await response.json()).toEqual({ user: "alice" });
  });

  it("answers with a +middleware that is a handler where the app has no route", async () => {
    const app = new Elysia();
    vike(app);
    expect(await (await send(app, "/x")).text()).toBe("handler");
  });

  it("answers with the app's route when a +middleware that is a handler has the same path", async () => {
    const app = new Elysia();
    vike(app);
    app.get("/x", () => "app");
    expect(await (await send(app, "/x")).text()).toBe("app");
  });

  it("applies the response step of the +middleware to the response of a route registered after vike(app) that returns a plain value, and of a page", async () => {
    const app = new Elysia();
    vike(app);
    app.get("/api/me", () => ({ api: true }));

    const api = await send(app, "/api/me", { headers: { "x-step": "1" } });
    expect(api.headers.get("x-step")).toBe("applied");
    expect(await api.json()).toEqual({ api: true });
    expect((await send(app, "/about", { headers: { "x-step": "1" } })).headers.get("x-step")).toBe("applied");
    expect((await send(app, "/api/me")).headers.get("x-step")).toBe(null);
  });

  it("keeps the context of concurrent requests apart", async () => {
    const app = new Elysia();
    vike(app);
    // @ts-expect-error getContext() is derived by the +middleware's plugin
    app.get("/api/me", async ({ getContext }) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return getContext().user;
    });

    const [slow, fast] = await Promise.all([
      send(app, "/api/me", { headers: { "x-user": "slow", "x-delay": "30" } }),
      send(app, "/api/me", { headers: { "x-user": "fast" } }),
    ]);
    expect([await slow.text(), await fast.text()]).toEqual(["slow", "fast"]);
  });

  it("renders a page after the app's routes", async () => {
    const app = new Elysia();
    vike(app);
    app.get("/api/me", () => "api");

    expect(await (await send(app, "/about")).text()).toBe("page /about");
  });

  it("answers with the app's route when a page has the same path", async () => {
    const app = new Elysia();
    vike(app);
    app.get("/about", () => "app");

    expect(await (await send(app, "/about")).text()).toBe("app");
  });

  // Over real HTTP, because an in-process `app.handle()` does not reproduce the empty body.
  it("hands a JSON body to a route registered after vike(app), over HTTP", async () => {
    const app = new Elysia();
    vike(app);
    app.post("/api/echo", ({ body }) => Response.json({ body }));

    const server = serve({ fetch: (request) => app.handle(request), port: 0, silent: true });
    try {
      await server.ready();
      const response = await fetch(new URL("/api/echo", server.url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ a: 1 }),
      });
      expect(await response.json()).toEqual({ body: { a: 1 } });
    } finally {
      await server.close(true);
    }
  });

  it("answers HEAD on a route registered after vike(app)", async () => {
    const app = new Elysia();
    vike(app);
    app.get("/api/me", () => "api");

    const response = await send(app, "/api/me", { method: "HEAD" });
    expect(response.status).toBe(200);
  });

  it("answers 404 for DELETE, from Vike's handler", async () => {
    const app = new Elysia();
    vike(app);

    const response = await send(app, "/about", { method: "DELETE" });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("page");
  });

  it("throws when vike(app) is called twice on the same app", () => {
    const app = new Elysia();
    vike(app);
    expect(() => vike(app)).toThrow(/already called/);
  });
});
