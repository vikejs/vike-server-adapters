import { Elysia } from "elysia";
import { serve } from "srvx";
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
      // Stands for a +middleware that is not a handler: getUniversalMiddlewares() returns only those, they run before the app's routes
      enhance((_request, context) => ({ ...context, early: true }), { name: "stub:early", order: -100 }),
    ],
    // Stands for Vike's pages: like the real one, it first runs the +middleware that are handlers (here /x), then renders the page
    universalHandler: enhance(
      async (request: Request) => {
        const { pathname } = new URL(request.url);
        return new Response(request.method === "GET" && pathname === "/x" ? "handler" : `page ${pathname}`);
      },
      {
        name: "stub:pages",
        method: ["GET", "POST"],
        path: "/**",
        immutable: true,
      },
    ),
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

  it("runs a +middleware with a negative order before the app's routes", async () => {
    const app = new Elysia();
    vike(app);
    // @ts-expect-error getContext() is derived by the +middleware's plugin
    app.get("/api/early", ({ getContext }) => String(getContext().early));
    expect(await (await send(app, "/api/early")).text()).toBe("true");
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

  // Needs a Universal Middleware release with #383: over real HTTP the route gets an empty body without it (an
  // in-process `app.handle()` hides that). Run it against a build with `UNIVERSAL_MIDDLEWARE_FIXED=1 pnpm test`; until
  // the dependency is bumped it is skipped.
  it.skipIf(!process.env.UNIVERSAL_MIDDLEWARE_FIXED)(
    "hands a JSON body to a route registered after vike(app), over HTTP",
    async () => {
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
    },
  );

  it("answers HEAD on a route registered after vike(app)", async () => {
    const app = new Elysia();
    vike(app);
    app.get("/api/me", () => "api");

    const response = await send(app, "/api/me", { method: "HEAD" });
    expect(response.status).toBe(200);
  });

  it("throws when vike(app) is called twice on the same app", () => {
    const app = new Elysia();
    vike(app);
    expect(() => vike(app)).toThrow(/already called/);
  });
});
