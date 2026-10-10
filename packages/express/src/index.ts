import { type App, apply, connectToWeb, createHandler } from "@universal-middleware/express";
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "express";
import { middlewaresAfterRoutes, middlewaresBeforeRoutes } from "vike/__internal";

export * from "@universal-middleware/express";

/**
 * Convert an Express app into a web `fetch` handler.
 *
 * `connectToWeb()` resolves to `undefined` when the request is passed through
 * without being handled (Connect's `next()`, or a middleware returning `false`).
 * A terminal `fetch` handler must always return a `Response`, so we fall back to
 * a `404` — mirroring the `nextOr404` convention of `@universal-middleware`'s own
 * handlers. This keeps the return type assignable to `Server['fetch']`.
 *
 * (`@vikejs/express` used to re-export srvx's `toFetchHandler`, but that one
 * deadlocks and doesn't work on Deno/Bun — see srvx#132.)
 */
export function toFetchHandler(app: Parameters<typeof connectToWeb>[0]): (request: Request) => Promise<Response> {
  const handler = connectToWeb(app);
  return async (request) => (await handler(request)) ?? new Response(null, { status: 404 });
}

type EnhancedMiddlewareExpress = Parameters<typeof apply>[1][number];

type Layer = { route?: { path: unknown; methods: Record<string, boolean> }; handle?: { stack?: Layer[] } };

const installed = new WeakSet<App>();

/**
 * Install the `+middleware` that aren't handlers right away, and the handlers with Vike's pages and not-found page when the first request arrives, so that the
 * routes the app registers after `vike(app)` keep their precedence over pages. A route registered after the first request
 * sits behind the pages.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareExpress[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/express] vike(app) was already called on this app: call it once.");
  }
  assertNoRouteBefore(app);
  installed.add(app);

  appendPagesOnFirstRequest(app);

  return apply(app, [...middlewares, middlewaresBeforeRoutes]);
}

function assertNoRouteBefore(app: App) {
  const route = findRouteBefore(routerStack(app) ?? []);
  if (route) {
    throw new Error(
      `[@vikejs/express] Call vike(app) before registering the app's routes: ${route.methods} ${route.path} was registered first, so the +middleware would not run for it. ` +
        `To answer a route before the +middleware, install them yourself: apply(app, middlewares.filter((m) => !m.isHandler)) and apply(app, middlewares.filter((m) => m.isHandler)), with the middlewares of (await getGlobalContext()).middlewares.`,
    );
  }
}

// Only routes have `layer.route`, also inside mounted routers; `express.static` and `cors()` are middleware.
// `app.all()` is every method: Express 4 sets `_all`, Express 5 lists them all.
function findRouteBefore(stack: Layer[]): { methods: string; path: string } | undefined {
  for (const layer of stack) {
    if (layer.route) {
      const { path, methods } = layer.route;
      const names = Object.keys(methods).filter((method) => methods[method]);
      if (names.every((method) => method === "options")) continue;
      if (isWildcard(path)) continue;
      return {
        methods: names.includes("_all") || names.length > 5 ? "ALL" : names.join(",").toUpperCase(),
        path: String(path),
      };
    }
    if (layer.handle?.stack) {
      const route = findRouteBefore(layer.handle.stack);
      if (route) return route;
    }
  }
}

function isWildcard(path: unknown) {
  return typeof path === "string" && path.includes("*");
}

// Express 4 keeps the router in `_router`, created on first use; Express 5 in `router`
function routerStack(app: App): Layer[] | undefined {
  const express4 = "del" in app;
  const router = express4
    ? (app as { _router?: { stack: Layer[] } })._router
    : (app as { router: { stack: Layer[] } }).router;
  return router?.stack;
}

function appendPagesOnFirstRequest(app: App) {
  const handle = app.handle;
  app.handle = function (this: App, ...args: Parameters<App["handle"]>) {
    app.handle = handle;
    const pages = createHandler(() => middlewaresAfterRoutes)();
    app.use((req: ExpressRequest, res: ExpressResponse, next: NextFunction) =>
      pages(req as Parameters<typeof pages>[0], res, next),
    );
    return handle.apply(this, args);
  };
}
