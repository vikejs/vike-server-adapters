import { enhance } from "@universal-middleware/core";
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

import { getUniversalMiddlewares, universalHandler } from "vike";
import vike, { apply } from "./index.js";

describe("@vikejs/srvx", () => {
  it("vike is a function", () => {
    expect(vike).toBeTypeOf("function");
  });

  it("apply is a function", () => {
    expect(apply).toBeTypeOf("function");
  });

  // srvx has no app: the routes in `middlewares` are the app's routes
  const send = (fetch: ReturnType<typeof vike>, path: string, init?: RequestInit) =>
    fetch(new Request(`http://localhost${path}`, init) as never);
  const apiRoute = async (_request: Request, context: Universal.Context) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response((context as { user: string }).user);
  };

  it("runs the +middleware before a route in middlewares, and the route sees the context", async () => {
    const fetch = vike([enhance(apiRoute, { name: "api", method: "GET", path: "/api/me" })]);

    const response = await send(fetch, "/api/me", { headers: { "x-user": "alice" } });
    expect(await response.text()).toBe("alice");
  });

  it("answers with a +middleware that is a handler where no route in middlewares matches", async () => {
    expect(await (await send(vike(), "/x")).text()).toBe("handler");
  });

  it("answers with the route in middlewares when a +middleware that is a handler has the same path", async () => {
    const fetch = vike([enhance(() => new Response("app"), { name: "app-x", method: "GET", path: "/x" })]);

    expect(await (await send(fetch, "/x")).text()).toBe("app");
  });

  it("runs a +middleware with a negative order before a route in middlewares", async () => {
    const fetch = vike([
      enhance((_request, context) => new Response(String((context as { early?: boolean }).early)), {
        name: "early-check",
        method: "GET",
        path: "/api/early",
      }),
    ]);

    expect(await (await send(fetch, "/api/early")).text()).toBe("true");
  });

  it("keeps the context of concurrent requests apart", async () => {
    const fetch = vike([enhance(apiRoute, { name: "api", method: "GET", path: "/api/me" })]);

    const [slow, fast] = await Promise.all([
      send(fetch, "/api/me", { headers: { "x-user": "slow", "x-delay": "30" } }),
      send(fetch, "/api/me", { headers: { "x-user": "fast" } }),
    ]);
    expect([await slow.text(), await fast.text()]).toEqual(["slow", "fast"]);
  });

  it("hands a JSON body to a route in middlewares", async () => {
    const fetch = vike([
      enhance(async (request: Request) => Response.json(await request.json()), {
        name: "echo",
        method: "POST",
        path: "/api/echo",
      }),
    ]);

    const response = await send(fetch, "/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(await response.json()).toEqual({ a: 1 });
  });

  it("answers HEAD on a route in middlewares", async () => {
    // A route declared for GET does not match HEAD, so the route declares both
    const fetch = vike([enhance(() => new Response("api"), { name: "api", method: ["GET", "HEAD"], path: "/api/me" })]);

    const response = await send(fetch, "/api/me", { method: "HEAD" });
    expect(response.status).toBe(200);
  });

  it("renders a page where no route matches", async () => {
    expect(await (await send(vike(), "/about")).text()).toBe("page /about");
  });

  it("answers 404 for DELETE, from Vike's handler", async () => {
    const response = await send(vike(), "/about", { method: "DELETE" });
    expect(response.status).toBe(404);
  });

  it("answers with the route in middlewares when a page has the same path", async () => {
    const fetch = vike([enhance(() => new Response("app"), { name: "about", method: "GET", path: "/about" })]);

    expect(await (await send(fetch, "/about")).text()).toBe("app");
  });

  // The README's manual example
  it("answers 404 for DELETE on the manual path", async () => {
    const fetch = apply([...getUniversalMiddlewares(), universalHandler]);

    expect((await send(fetch, "/about", { method: "DELETE" })).status).toBe(404);
  });
});
