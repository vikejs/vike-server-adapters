import { getUniversalProp, methodSymbol } from "@universal-middleware/core";
import { type App, apply, createHandler } from "@universal-middleware/hono";
import type { MiddlewareHandler } from "hono";
import { getUniversalMiddlewares, universalHandler } from "vike";

export * from "@universal-middleware/hono";

type EnhancedMiddlewareHono = Parameters<typeof apply>[1][number];

// Vike's pages answer the methods its handler declares, not DELETE for example
const pagesMethods: string[] = [getUniversalProp(universalHandler, methodSymbol) ?? []].flat();

const installed = new WeakSet<App>();

/**
 * Install the `+middleware` that aren't handlers right away, and the handlers with Vike's pages and not-found page as `app.notFound()`, so that the routes
 * the app registers after `vike(app)` keep their precedence over pages.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareHono[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/hono] vike(app) was already called on this app: call it once.");
  }
  assertNoRouteBefore(app);
  installed.add(app);

  renderPagesOnNotFound(app);
  guardNotFound(app);

  return apply(app, [...middlewares, ...getUniversalMiddlewares()]);
}

function assertNoRouteBefore(app: App) {
  const route = app.routes.find((route) => route.method !== "OPTIONS" && isAppRoute(route));
  if (route) {
    throw new Error(
      `[@vikejs/hono] Call vike(app) before registering the app's routes: ${route.method} ${route.path} was registered first, so the +middleware would not run for it. ` +
        `To answer a route before the +middleware, install them yourself: apply(app, getUniversalMiddlewares()) and apply(app, [universalHandler]).`,
    );
  }
}

// `app.use()` registers `ALL`, so a `GET` or `POST` entry is a route the app wrote
function isAppRoute({ method, path }: { method: string; path: string }) {
  return method !== "ALL" && !path.includes("*");
}

// The contexts that went through the guard and whose routes haven't called `c.notFound()` since
const fallThrough = new WeakSet<object>();

function renderPagesOnNotFound(app: App) {
  const pages = createHandler(() => universalHandler)();
  app.notFound(async (c) => {
    // Hono calls this both when the routes pass the request on and when a route calls `c.notFound()`, which is a 404,
    // including a route registered before vike(app), which ends the request before the guard
    if (!fallThrough.has(c)) return c.text("404 Not Found", 404);
    if (!pagesMethods.includes(c.req.method)) return c.text("404 Not Found", 404);
    return (await pages(c, async () => {})) as Response;
  });
}

// Runs before the app's routes on every request
function guardNotFound(app: App) {
  let notFoundReplaced = false;
  const setNotFound = app.notFound;
  // Watches the app.notFound() calls made from now on, so it runs after renderPagesOnNotFound()
  app.notFound = (handler) => {
    notFoundReplaced = true;
    return setNotFound(handler);
  };
  const guard: MiddlewareHandler = async (c, next) => {
    // Throws at the first request, where the app is complete: calling app.notFound() later would hide the pages
    if (notFoundReplaced) {
      throw new Error(
        "[@vikejs/hono] app.notFound() was called after vike(app), which replaced the handler that renders Vike's pages. " +
          "Use app.onError() or a route instead, or install the pages yourself: apply(app, [universalHandler]).",
      );
    }
    // app.route() copies the routes but not app.notFound(), so a parent app would answer its own 404 instead of the pages
    const route = c.req.matchedRoutes.find((route) => route.handler === guard);
    if (!route || !app.routes.includes(route)) {
      throw new Error(
        "[@vikejs/hono] An app that vike(app) was called on was mounted with app.route(), which does not carry app.notFound() with it, so its pages would not render. " +
          "Call vike(app) on the app that serves the requests, the parent, and not on the mounted app.",
      );
    }
    fallThrough.add(c);
    const notFound = c.notFound;
    c.notFound = () => {
      fallThrough.delete(c);
      return notFound();
    };
    await next();
  };
  app.use(guard);
}
