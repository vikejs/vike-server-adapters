import { enhance } from "@universal-middleware/core";
import { type Handler, Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
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

import vike, { apply, getContext } from "./index.js";

describe("@vikejs/hono", () => {
  it("vike is a function", () => {
    expect(vike).toBeTypeOf("function");
  });

  it("apply is a function", () => {
    expect(apply).toBeTypeOf("function");
  });

  it("runs the +middleware before a route registered after vike(app), and the route sees the context", async () => {
    const app = new Hono();
    vike(app);
    app.get("/api/me", (c) => c.json({ user: (getContext(c as never) as { user: string }).user }));

    const response = await app.request("/api/me", { headers: { "x-user": "alice" } });
    expect(await response.json()).toEqual({ user: "alice" });
  });

  it("answers with a +middleware that is a handler where the app has no route", async () => {
    const app = new Hono();
    vike(app);
    expect(await (await app.request("/x")).text()).toBe("handler");
  });

  it("answers with the app's route when a +middleware that is a handler has the same path", async () => {
    const app = new Hono();
    vike(app);
    app.get("/x", (c) => c.text("app"));
    expect(await (await app.request("/x")).text()).toBe("app");
  });

  it("applies the response step of the +middleware to the response of a route registered after vike(app), and of a page", async () => {
    const app = new Hono();
    vike(app);
    app.get("/api/me", (c) => c.text("api"));

    for (const path of ["/api/me", "/about"]) {
      expect((await app.request(path, { headers: { "x-step": "1" } })).headers.get("x-step")).toBe("applied");
    }
    expect((await app.request("/api/me")).headers.get("x-step")).toBe(null);
  });

  it("keeps the context of concurrent requests apart", async () => {
    const app = new Hono();
    vike(app);
    app.get("/api/me", async (c) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return c.text((getContext(c as never) as { user: string }).user);
    });

    const [slow, fast] = await Promise.all([
      app.request("/api/me", { headers: { "x-user": "slow", "x-delay": "30" } }),
      app.request("/api/me", { headers: { "x-user": "fast" } }),
    ]);
    expect([await slow.text(), await fast.text()]).toEqual(["slow", "fast"]);
  });

  it("renders a page after the app's routes", async () => {
    const app = new Hono();
    vike(app);
    app.get("/api/me", (c) => c.text("api"));

    const response = await app.request("/about");
    expect(await response.text()).toBe("page /about");
  });

  it("answers with the app's route when a page has the same path", async () => {
    const app = new Hono();
    vike(app);
    app.get("/about", (c) => c.text("app"));

    expect(await (await app.request("/about")).text()).toBe("app");
  });

  it("answers Hono's own not-found when a matched route calls c.notFound()", async () => {
    const app = new Hono();
    vike(app);
    app.get("/user/:id", (c) => c.notFound());

    const response = await app.request("/user/1");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("404 Not Found");
  });

  it("renders a page when a middleware on the page's path passes the request on", async () => {
    const app = new Hono();
    vike(app);
    app.use("/about", (_c, next) => next());

    expect(await (await app.request("/about")).text()).toBe("page /about");
  });

  it("renders a page when a method-specific middleware on the page's path passes the request on", async () => {
    const app = new Hono();
    vike(app);
    app.get("/about", async (_c, next) => {
      await next();
    });

    expect(await (await app.request("/about")).text()).toBe("page /about");
  });

  it("answers with a +middleware that is a handler when a method-specific middleware on its path passes the request on", async () => {
    const app = new Hono();
    vike(app);
    app.get("/x", async (_c, next) => {
      await next();
    });

    expect(await (await app.request("/x")).text()).toBe("handler");
  });

  it("answers Hono's own not-found when a wildcard route calls c.notFound()", async () => {
    const app = new Hono();
    vike(app);
    app.get("/users/*", (c) => c.notFound());

    const response = await app.request("/users/missing");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("404 Not Found");
  });

  it.each([
    "use",
    "get",
  ] as const)("answers Hono's own not-found when a wildcard route registered before vike(app) calls c.notFound() with %s", async (method) => {
    const app = new Hono();
    const notFound: Handler = (c) => c.notFound();
    if (method === "use") app.use("/static/*", notFound);
    else app.get("/static/*", notFound);
    vike(app);

    const response = await app.request("/static/missing");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("404 Not Found");
  });

  it("doesn't reach a +middleware that is a handler past an auth middleware when a route registered before vike(app) calls c.notFound()", async () => {
    const auth = enhance(
      (request: Request) => (request.headers.has("x-deny") ? new Response("denied", { status: 401 }) : undefined),
      {
        name: "auth",
        order: -100,
      },
    );
    const app = new Hono();
    app.get("/x/*", (c) => c.notFound());
    vike(app, [auth]);

    const response = await app.request("/x", { headers: { "x-deny": "1" } });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("404 Not Found");
  });

  it("renders a page when a route registered before vike(app) passes the request on", async () => {
    const app = new Hono();
    app.get("/static/*", (_c, next) => next());
    vike(app);

    expect(await (await app.request("/static/missing.css")).text()).toBe("page /static/missing.css");
  });

  it("renders a page when a wildcard route such as serveStatic passes the request on", async () => {
    const app = new Hono();
    vike(app);
    app.get("/static/*", (_c, next) => next());

    expect(await (await app.request("/static/missing.css")).text()).toBe("page /static/missing.css");
  });

  it("hands a JSON body to a route registered after vike(app)", async () => {
    const app = new Hono();
    vike(app);
    app.post("/api/echo", async (c) => c.json(await c.req.json()));

    const response = await app.request("/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(await response.json()).toEqual({ a: 1 });
  });

  it("answers HEAD on a route registered after vike(app)", async () => {
    const app = new Hono();
    vike(app);
    app.get("/api/me", (c) => c.text("api"));

    expect((await app.request("/api/me", { method: "HEAD" })).status).toBe(200);
  });

  it("answers 404 for DELETE, from Vike's handler", async () => {
    const app = new Hono();
    vike(app);

    const response = await app.request("/about", { method: "DELETE" });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("places the extra middlewares before the +middleware", async () => {
    const order: string[] = [];
    const app = new Hono();
    vike(app, [
      enhance(
        (_request, context) => {
          order.push("extra");
          return context;
        },
        { name: "extra" },
      ),
    ]);
    app.get("/", (c) => c.text(order.join()));

    expect(await (await app.request("/")).text()).toBe("extra");
  });

  describe("a route registered before vike(app)", () => {
    it.each([
      ["GET", (app: Hono) => app.get("/health", (c) => c.text("ok"))],
      ["POST", (app: Hono) => app.post("/submit", (c) => c.text("ok"))],
    ])("throws for a %s route", (_method, register) => {
      const app = new Hono();
      register(app);
      expect(() => vike(app)).toThrow(/Call vike\(app\) before registering the app's routes/);
    });

    it.each([
      ["a logger", (app: Hono) => app.use(logger(() => {}))],
      ["cors()", (app: Hono) => app.use(cors())],
      ["cors() on a path", (app: Hono) => app.use("/api/*", cors())],
      ["a preflight OPTIONS route", (app: Hono) => app.options("/health", (c) => c.body(null, 204))],
      ["a preflight OPTIONS route on a wildcard path", (app: Hono) => app.options("/*", (c) => c.body(null, 204))],
      ["a static file route on a wildcard path", (app: Hono) => app.get("/static/*", (_c, next) => next())],
      ["app.all on a wildcard path", (app: Hono) => app.all("/*", (_c, next) => next())],
    ])("does not throw for %s", (_name, register) => {
      const app = new Hono();
      register(app);
      expect(() => vike(app)).not.toThrow();
    });
  });

  it("throws when vike(app) is called twice on the same app", () => {
    const app = new Hono();
    vike(app);
    expect(() => vike(app)).toThrow(/already called/);
  });

  it("throws at the first request when the app is mounted with app.route(), which drops app.notFound()", async () => {
    const child = new Hono();
    vike(child);
    const parent = new Hono().route("/", child);
    parent.onError((error, c) => c.text(error.message, 500));

    const response = await parent.request("/about");
    expect(response.status).toBe(500);
    expect(await response.text()).toMatch(/mounted with app\.route\(\)/);
  });

  it("throws at the first request when app.notFound() replaced the handler", async () => {
    const app = new Hono();
    vike(app);
    app.notFound((c) => c.text("mine", 404));
    app.onError((error, c) => c.text(error.message, 500));

    const response = await app.request("/about");
    expect(response.status).toBe(500);
    expect(await response.text()).toMatch(/app\.notFound\(\) was called after vike\(app\)/);
  });
});
