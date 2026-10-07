import { Elysia } from "elysia";
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

describe("@vikejs/elysia", () => {
  it("vike is a function", () => {
    expect(vike).toBeTypeOf("function");
  });

  it("apply is a function", () => {
    expect(apply).toBeTypeOf("function");
  });

  const get = (app: Elysia, path: string, headers: Record<string, string> = {}) =>
    app.handle(new Request(`http://localhost${path}`, { headers }));

  it("runs the +middleware before a route registered after vike(app), and the route sees the context", async () => {
    const app = new Elysia();
    vike(app);
    // @ts-expect-error getContext() is derived by the +middleware's plugin
    app.get("/api/me", ({ getContext }) => ({ user: getContext().user }));

    const response = await get(app, "/api/me", { "x-user": "alice" });
    expect(await response.json()).toEqual({ user: "alice" });
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
      get(app, "/api/me", { "x-user": "slow", "x-delay": "30" }),
      get(app, "/api/me", { "x-user": "fast" }),
    ]);
    expect([await slow.text(), await fast.text()]).toEqual(["slow", "fast"]);
  });

  it("renders a page after the app's routes", async () => {
    const app = new Elysia();
    vike(app);
    app.get("/api/me", () => "api");

    expect(await (await get(app, "/about")).text()).toBe("page /about");
  });

  it("answers with the app's route when a page has the same path", async () => {
    const app = new Elysia();
    vike(app);
    app.get("/about", () => "app");

    expect(await (await get(app, "/about")).text()).toBe("app");
  });

  it("throws when vike(app) is called twice on the same app", () => {
    const app = new Elysia();
    vike(app);
    expect(() => vike(app)).toThrow(/already called/);
  });
});
