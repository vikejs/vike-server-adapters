import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

// A test sets `beforeContextSet` to hold every request's +middleware until all of them have arrived
const hooks = vi.hoisted(() => ({ beforeContextSet: undefined as undefined | (() => Promise<void>) }));

vi.mock("vike", async () => {
  const { enhance } = await import("@universal-middleware/core");
  return {
    // Stands for the user's +middleware: it puts the `x-user` header in the context, after `hooks.beforeContextSet`
    getUniversalMiddlewares: () => [
      enhance(
        async (request: Request, context: Universal.Context) => {
          await hooks.beforeContextSet?.();
          return { ...context, user: request.headers.get("x-user") };
        },
        { name: "stub:middleware" },
      ),
      // Stands for a +middleware that sets headers on the response
      enhance(() => (response: Response) => response, { name: "stub:response-step" }),
      // Stands for a +middleware that is not a handler: getUniversalMiddlewares() returns only those, they run before the app's routes
      enhance((_request, context) => ({ ...context, early: true }), { name: "stub:early", order: -100 }),
    ],
    // Stands for Vike's pages: like the real one, it first runs the +middleware that are handlers (here /x), then renders the page
    universalHandler: enhance(async (request: Request) => {
      const { pathname } = new URL(request.url);
      return new Response(request.method === "GET" && pathname === "/x" ? "handler" : `page ${pathname}`);
    }, {
      name: "stub:pages",
      method: ["GET", "POST"],
      path: "/**",
      immutable: true,
    }),
  };
});

import vike, { apply, getContext, toFetchHandler } from "./index.js";

describe("@vikejs/fastify", () => {
  it("vike is a function", () => {
    expect(vike).toBeTypeOf("function");
  });

  it("apply is a function", () => {
    expect(apply).toBeTypeOf("function");
  });

  it("toFetchHandler is a function", () => {
    expect(toFetchHandler).toBeTypeOf("function");
  });

  const user = (request: Parameters<typeof getContext>[0]) => (getContext(request) as { user: string }).user;

  it("runs the +middleware before a route registered after vike(app), and the route sees the context", async () => {
    const app = Fastify();
    await vike(app);
    app.get("/api/me", (request) => ({ user: user(request) }));

    const response = await app.inject({ url: "/api/me", headers: { "x-user": "alice" } });
    expect(response.json()).toEqual({ user: "alice" });
  });

  it("answers with a +middleware that is a handler where the app has no route", async () => {
    const app = Fastify();
    await vike(app);
    expect((await app.inject({ url: "/x" })).body).toBe("handler");
  });

  it("answers with the app's route when a +middleware that is a handler has the same path", async () => {
    const app = Fastify();
    await vike(app);
    app.get("/x", () => "app");
    expect((await app.inject({ url: "/x" })).body).toBe("app");
  });

  it("runs a +middleware with a negative order before the app's routes", async () => {
    const app = Fastify();
    await vike(app);
    app.get("/api/early", (request) => String((getContext(request) as { early?: boolean }).early));
    expect((await app.inject({ url: "/api/early" })).body).toBe("true");
  });

  it("renders a page after the app's routes", async () => {
    const app = Fastify();
    await vike(app);
    app.get("/api/me", () => "api");

    expect((await app.inject({ url: "/about" })).body).toBe("page /about");
  });

  it("answers with the app's route when a page has the same path", async () => {
    const app = Fastify();
    await vike(app);
    app.get("/about", () => "app");

    expect((await app.inject({ url: "/about" })).body).toBe("app");
  });

  it("answers 404 for a method Vike's handler does not declare", async () => {
    const app = Fastify();
    await vike(app);

    const response = await app.inject({ method: "DELETE", url: "/about" });
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain("page");
  });

  // These need a Universal Middleware release with #382 (context per request), #383 (JSON body) and #384 (HEAD,
  // redirect, 204): they fail against the published one. Run them against a build of both with `UNIVERSAL_MIDDLEWARE_FIXED=1 pnpm test`; until the
  // dependency is bumped they are skipped.
  const needsFixedUniversalMiddleware = it.skipIf(!process.env.UNIVERSAL_MIDDLEWARE_FIXED);

  needsFixedUniversalMiddleware("hands a JSON body to a route registered after vike(app)", async () => {
    const app = Fastify();
    await vike(app);
    app.post("/api/echo", (request) => request.body);

    const response = await app.inject({ method: "POST", url: "/api/echo", payload: { a: 1 } });
    expect(response.json()).toEqual({ a: 1 });
  });

  needsFixedUniversalMiddleware("answers HEAD on a route registered after vike(app)", async () => {
    const app = Fastify();
    await vike(app);
    app.get("/api/me", () => "api");

    expect((await app.inject({ method: "HEAD", url: "/api/me" })).statusCode).toBe(200);
  });

  needsFixedUniversalMiddleware("keeps a redirect and a 204 from a route registered after vike(app)", async () => {
    const app = Fastify();
    await vike(app);
    app.get("/old", (_request, reply) => reply.redirect("/new", 302));
    app.get("/empty", (_request, reply) => reply.code(204).send());

    const redirect = await app.inject({ url: "/old" });
    expect([redirect.statusCode, redirect.headers.location]).toEqual([302, "/new"]);
    expect((await app.inject({ url: "/empty" })).statusCode).toBe(204);
  });

  // A request reads the context after an await, while the other request's +middleware has already set its own. The
  // barriers make the two requests interleave every time, so the test fails if the context is shared between requests
  // (the released Universal Middleware keeps it on the route's config) and needs a release with #382.
  needsFixedUniversalMiddleware("keeps the context of concurrent requests apart", async () => {
    const meet = (count: number) => {
      let arrived = 0;
      let release: () => void;
      const met = new Promise<void>((resolve) => (release = resolve));
      return () => {
        if (++arrived === count) release();
        return met;
      };
    };
    const middlewaresDone = meet(2);
    const routesStarted = meet(2);
    hooks.beforeContextSet = middlewaresDone;
    try {
      const app = Fastify();
      await vike(app);
      app.get("/api/me", async (request) => {
        await routesStarted();
        return user(request);
      });

      const [alice, bob] = await Promise.all([
        app.inject({ url: "/api/me", headers: { "x-user": "alice" } }),
        app.inject({ url: "/api/me", headers: { "x-user": "bob" } }),
      ]);
      expect([alice.body, bob.body]).toEqual(["alice", "bob"]);
    } finally {
      hooks.beforeContextSet = undefined;
    }
  });

  it("throws when vike(app) is called twice on the same app", async () => {
    const app = Fastify();
    await vike(app);
    expect(() => vike(app)).toThrow(/already called/);
  });
});
