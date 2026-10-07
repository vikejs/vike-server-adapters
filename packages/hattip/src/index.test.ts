import { createRouter } from "@hattip/router";
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

import vike, { apply, getContext } from "./index.js";

describe("@vikejs/hattip", () => {
  it("vike is a function", () => {
    expect(vike).toBeTypeOf("function");
  });

  it("apply is a function", () => {
    expect(apply).toBeTypeOf("function");
  });

  const get = (router: ReturnType<typeof createRouter>, path: string, headers: Record<string, string> = {}) => {
    const request = new Request(`http://localhost${path}`, { headers });
    // biome-ignore lint/suspicious/noExplicitAny: a minimal HatTip context
    return router.buildHandler()({ request, url: new URL(request.url), method: request.method } as any);
  };
  const user = (context: unknown) => (getContext(context as Parameters<typeof getContext>[0]) as { user: string }).user;

  it("runs the +middleware before a route registered after vike(app), and the route sees the context", async () => {
    const router = createRouter();
    vike(router);
    router.get("/api/me", (context) => Response.json({ user: user(context) }));

    const response = await get(router, "/api/me", { "x-user": "alice" });
    expect(await response?.json()).toEqual({ user: "alice" });
  });

  it("keeps the context of concurrent requests apart", async () => {
    const router = createRouter();
    vike(router);
    router.get("/api/me", async (context) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(user(context));
    });

    const handler = router.buildHandler();
    const call = (headers: Record<string, string>) => {
      const request = new Request("http://localhost/api/me", { headers });
      // biome-ignore lint/suspicious/noExplicitAny: a minimal HatTip context
      return handler({ request, url: new URL(request.url), method: "GET" } as any);
    };
    const [slow, fast] = await Promise.all([call({ "x-user": "slow", "x-delay": "30" }), call({ "x-user": "fast" })]);
    expect([await slow?.text(), await fast?.text()]).toEqual(["slow", "fast"]);
  });

  it("renders a page after the app's routes", async () => {
    const router = createRouter();
    vike(router);
    router.get("/api/me", () => new Response("api"));

    expect(await (await get(router, "/about"))?.text()).toBe("page /about");
  });

  it("answers with the app's route when a page has the same path", async () => {
    const router = createRouter();
    vike(router);
    router.get("/about", () => new Response("app"));

    expect(await (await get(router, "/about"))?.text()).toBe("app");
  });

  it("hands a JSON body to a route registered after vike(app)", async () => {
    const router = createRouter();
    vike(router);
    router.post("/api/echo", async (context) => Response.json(await context.request.json()));

    const request = new Request("http://localhost/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    // biome-ignore lint/suspicious/noExplicitAny: a minimal HatTip context
    const response = await router.buildHandler()({ request, url: new URL(request.url), method: "POST" } as any);
    expect(await response?.json()).toEqual({ a: 1 });
  });

  it("answers HEAD on a route registered after vike(app)", async () => {
    const router = createRouter();
    vike(router);
    // HatTip's router doesn't match HEAD to a `get` route, so the route answers every method
    router.use("/api/me", () => new Response("api"));

    const request = new Request("http://localhost/api/me", { method: "HEAD" });
    // biome-ignore lint/suspicious/noExplicitAny: a minimal HatTip context
    const response = await router.buildHandler()({ request, url: new URL(request.url), method: "HEAD" } as any);
    expect(response?.status).toBe(200);
  });

  it("throws when vike(app) is called twice on the same app", () => {
    const router = createRouter();
    vike(router);
    expect(() => vike(router)).toThrow(/already called/);
  });
});
