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

import vike, { apply } from "./index.js";

describe("@vikejs/srvx", () => {
  it("vike is a function", () => {
    expect(vike).toBeTypeOf("function");
  });

  it("apply is a function", () => {
    expect(apply).toBeTypeOf("function");
  });

  // srvx has no app: the routes in `middlewares` are the app's routes
  const get = (fetch: ReturnType<typeof vike>, path: string, headers: Record<string, string> = {}) =>
    fetch(new Request(`http://localhost${path}`, { headers }) as never);
  const apiRoute = async (_request: Request, context: Universal.Context) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response((context as { user: string }).user);
  };

  it("runs the +middleware before a route in middlewares, and the route sees the context", async () => {
    const { enhance } = await import("@universal-middleware/core");
    const fetch = vike([enhance(apiRoute, { name: "api", method: "GET", path: "/api/me" })]);

    const response = await get(fetch, "/api/me", { "x-user": "alice" });
    expect(await response.text()).toBe("alice");
  });

  it("keeps the context of concurrent requests apart", async () => {
    const { enhance } = await import("@universal-middleware/core");
    const fetch = vike([enhance(apiRoute, { name: "api", method: "GET", path: "/api/me" })]);

    const [slow, fast] = await Promise.all([
      get(fetch, "/api/me", { "x-user": "slow", "x-delay": "30" }),
      get(fetch, "/api/me", { "x-user": "fast" }),
    ]);
    expect([await slow.text(), await fast.text()]).toEqual(["slow", "fast"]);
  });

  it("renders a page where no route matches", async () => {
    expect(await (await get(vike(), "/about")).text()).toBe("page /about");
  });

  it("answers 404 instead of throwing for a method Vike's handler does not declare", async () => {
    const response = await vike()(new Request("http://localhost/about", { method: "DELETE" }) as never);
    expect(response.status).toBe(404);
  });

  it("answers with the route in middlewares when a page has the same path", async () => {
    const { enhance } = await import("@universal-middleware/core");
    const fetch = vike([enhance(() => new Response("app"), { name: "about", method: "GET", path: "/about" })]);

    expect(await (await get(fetch, "/about")).text()).toBe("app");
  });
});
