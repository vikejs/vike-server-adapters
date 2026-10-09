import { createServer } from "node:http";
import { enhance } from "@universal-middleware/core";
import cors from "cors";
import express from "express";
import { describe, expect, it, vi } from "vitest";

// Stands for the proxy of Vike's +middleware that aren't handlers, which vike(app) applies and which looks the list up upon each request. Here: the user's
// +middleware puts the `x-user` header in the context, after `x-delay` milliseconds, and an early one sets `early`
vi.mock("vike/__internal", async () => {
  const { enhance } = await import("@universal-middleware/core");
  return {
    plusMiddlewareProxy: enhance(
      async (request: Request, context: Universal.Context) => {
        await new Promise((resolve) => setTimeout(resolve, Number(request.headers.get("x-delay") ?? 0)));
        return { ...context, early: true, user: request.headers.get("x-user") };
      },
      { name: "stub:proxy" },
    ),
  };
});

vi.mock("vike", async () => {
  const { enhance } = await import("@universal-middleware/core");
  return {
    // Stands for Vike's pages: like the real one, it declares every method, first runs the +middleware that are handlers (here /x), answers 404 for a method the pages don't serve, then renders the page
    universalHandler: enhance(
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
  };
});

import vike, { getContext, toFetchHandler } from "./index.js";

describe("toFetchHandler", () => {
  it("falls back to 404 when the app doesn't handle the request", async () => {
    const app = express();

    const response = await toFetchHandler(app)(new Request("http://localhost/missing"));
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
  });

  it("handles GET request", async () => {
    const app = express();
    app.get("/ping", (_req, res) => {
      res.send("pong");
    });

    const response = await toFetchHandler(app)(new Request("http://localhost/ping"));
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("pong");
  });

  it("handles POST with JSON body on synthetic path (regression: no body double-read)", async () => {
    const app = express();
    app.use(express.json());
    app.post("/echo", (req, res) => {
      res.json(req.body);
    });

    const payload = JSON.stringify({ hello: "world" });
    const response = await toFetchHandler(app)(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(payload)),
        },
        body: payload,
      }),
    );
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ hello: "world" });
  });
});

describe("vike(app)", () => {
  const user = (req: express.Request) => (getContext(req as Parameters<typeof getContext>[0]) as { user: string }).user;
  const send = (app: express.Express, path: string, init?: RequestInit) =>
    toFetchHandler(app)(new Request(`http://localhost${path}`, init));

  it("runs the +middleware before a route registered after vike(app), and the route sees the context", async () => {
    const app = express();
    vike(app);
    app.get("/api/me", (req, res) => {
      res.json({ user: user(req) });
    });

    const response = await send(app, "/api/me", { headers: { "x-user": "alice" } });
    expect(await response.json()).toEqual({ user: "alice" });
  });

  it("answers with a +middleware that is a handler where the app has no route", async () => {
    const app = express();
    vike(app);
    expect(await (await send(app, "/x")).text()).toBe("handler");
  });

  it("answers with the app's route when a +middleware that is a handler has the same path", async () => {
    const app = express();
    vike(app);
    app.get("/x", (_req, res) => {
      res.send("app");
    });
    expect(await (await send(app, "/x")).text()).toBe("app");
  });

  it("runs a +middleware with a negative order before the app's routes", async () => {
    const app = express();
    vike(app);
    app.get("/api/early", (req, res) => {
      res.send(String((getContext(req as Parameters<typeof getContext>[0]) as { early?: boolean }).early));
    });
    expect(await (await send(app, "/api/early")).text()).toBe("true");
  });

  it("keeps the context of concurrent requests apart", async () => {
    const app = express();
    vike(app);
    app.get("/api/me", async (req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      res.send(user(req));
    });

    const [slow, fast] = await Promise.all([
      send(app, "/api/me", { headers: { "x-user": "slow", "x-delay": "30" } }),
      send(app, "/api/me", { headers: { "x-user": "fast" } }),
    ]);
    expect([await slow.text(), await fast.text()]).toEqual(["slow", "fast"]);
  });

  it("renders a page after the app's routes", async () => {
    const app = express();
    vike(app);
    app.get("/api/me", (_req, res) => {
      res.send("api");
    });

    expect(await (await send(app, "/about")).text()).toBe("page /about");
  });

  it("answers with the app's route when a page has the same path", async () => {
    const app = express();
    vike(app);
    app.get("/about", (_req, res) => {
      res.send("app");
    });

    expect(await (await send(app, "/about")).text()).toBe("app");
  });

  it("hands a JSON body to a route registered after vike(app)", async () => {
    const app = express();
    vike(app);
    app.post("/api/echo", express.json(), (req, res) => {
      res.json(req.body);
    });

    const response = await send(app, "/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(await response.json()).toEqual({ a: 1 });
  });

  // Needs a Universal Middleware release with #383: over a real Node request the middleware builds its `Request` from a
  // stream `express.json()` already consumed, and the app answers 500 without it (`toFetchHandler` hides that). Run it
  // against a build with `UNIVERSAL_MIDDLEWARE_FIXED=1 pnpm test`; until the dependency is bumped it is skipped.
  it.skipIf(!process.env.UNIVERSAL_MIDDLEWARE_FIXED)(
    "hands a JSON body to a route when express.json() is registered before vike(app)",
    async () => {
      const app = express();
      app.use(express.json());
      vike(app);
      app.post("/api/echo", (req, res) => {
        res.json({ body: req.body });
      });

      const server = createServer(app).listen(0);
      try {
        await new Promise((resolve) => server.once("listening", resolve));
        const { port } = server.address() as { port: number };
        const response = await fetch(`http://localhost:${port}/api/echo`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ a: 1 }),
        });
        expect(await response.json()).toEqual({ body: { a: 1 } });
      } finally {
        server.close();
      }
    },
  );

  it("answers HEAD on a route registered after vike(app)", async () => {
    const app = express();
    vike(app);
    app.get("/api/me", (_req, res) => {
      res.send("api");
    });

    const response = await send(app, "/api/me", { method: "HEAD" });
    expect(response.status).toBe(200);
  });

  it("answers 404 for DELETE, from Vike's handler", async () => {
    const app = express();
    vike(app);

    const response = await send(app, "/about", { method: "DELETE" });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("page");
  });

  it("places the extra middlewares before the +middleware", async () => {
    const order: string[] = [];
    const app = express();
    vike(app, [
      enhance(
        (_request, context) => {
          order.push("extra");
          return context;
        },
        { name: "extra" },
      ),
    ]);
    app.get("/", (_req, res) => {
      res.send(order.join());
    });

    expect(await (await send(app, "/")).text()).toBe("extra");
  });

  describe("a route registered before vike(app)", () => {
    const sub = () => {
      const router = express.Router();
      router.get("/inner", (_req, res) => {
        res.send("ok");
      });
      return router;
    };

    it.each([
      ["GET", (app: express.Express) => app.get("/health", (_req, res) => void res.send("ok"))],
      ["POST", (app: express.Express) => app.post("/submit", (_req, res) => void res.send("ok"))],
      ["a route of a mounted router", (app: express.Express) => app.use("/sub", sub())],
    ])("throws for %s", (_name, register) => {
      const app = express();
      register(app);
      expect(() => vike(app)).toThrow(/Call vike\(app\) before registering the app's routes/);
    });

    it("names app.all as ALL", () => {
      const app = express();
      app.all("/health", (_req, res) => void res.send("ok"));
      expect(() => vike(app)).toThrow(/ALL \/health was registered first/);
    });

    it.each([
      ["express.static", (app: express.Express) => app.use(express.static("."))],
      ["cors()", (app: express.Express) => app.use(cors())],
      ["a preflight route", (app: express.Express) => app.options("/health", cors())],
      ["a preflight route on a wildcard path", (app: express.Express) => app.options("/{*any}", cors())],
      ["a wildcard route", (app: express.Express) => app.all("/{*any}", (_req, _res, next) => next())],
      ["a logger", (app: express.Express) => app.use((_req, _res, next) => next())],
      ["a mounted router without routes", (app: express.Express) => app.use("/sub", express.Router())],
    ])("does not throw for %s", (_name, register) => {
      const app = express();
      register(app);
      expect(() => vike(app)).not.toThrow();
    });
  });

  it("throws when vike(app) is called twice on the same app", () => {
    const app = express();
    vike(app);
    expect(() => vike(app)).toThrow(/already called/);
  });
});
