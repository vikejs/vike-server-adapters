import Fastify from "fastify";
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

  it("keeps the context of concurrent requests apart", async () => {
    const app = Fastify();
    await vike(app);
    app.get("/api/me", async (request) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return user(request);
    });

    const [slow, fast] = await Promise.all([
      app.inject({ url: "/api/me", headers: { "x-user": "slow", "x-delay": "30" } }),
      app.inject({ url: "/api/me", headers: { "x-user": "fast" } }),
    ]);
    expect([slow.body, fast.body]).toEqual(["slow", "fast"]);
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

  it("throws when vike(app) is called twice on the same app", async () => {
    const app = Fastify();
    await vike(app);
    expect(() => vike(app)).toThrow(/already called/);
  });
});
