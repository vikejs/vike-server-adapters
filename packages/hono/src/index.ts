import { getUniversalProp, methodSymbol } from "@universal-middleware/core";
import { type App, apply, createHandler } from "@universal-middleware/hono";
import { getUniversalMiddlewares, universalHandler } from "vike";

export * from "@universal-middleware/hono";

type EnhancedMiddlewareHono = Parameters<typeof apply>[1][number];

// Vike's pages answer the methods its handler declares, not DELETE for example
const pagesMethods: string[] = [getUniversalProp(universalHandler, methodSymbol) ?? []].flat();

const installed = new WeakSet<App>();

// `app.use()` registers `ALL`, so a `GET` or `POST` entry is a route the app wrote
function isWildcard(path: string) {
  return path.includes("*");
}

function isAppRoute({ method, path }: { method: string; path: string }) {
  return method !== "ALL" && !isWildcard(path);
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

function renderPagesOnNotFound(app: App) {
  const pages = createHandler(() => universalHandler)();
  app.notFound(async (c) => {
    // A route that matched and answered with `c.notFound()` is answered by Hono, not by a page
    if (c.req.matchedRoutes.some(isAppRoute) || !pagesMethods.includes(c.req.method)) {
      return c.text("404 Not Found", 404);
    }
    return (await pages(c, async () => {})) as Response;
  });
}

function assertNotFoundNotReplaced(app: App) {
  let notFoundReplaced = false;
  const setNotFound = app.notFound;
  app.notFound = (handler) => {
    notFoundReplaced = true;
    return setNotFound(handler);
  };
  // Throws at the first request, where the app is complete: calling app.notFound() later would hide the pages
  app.use(async (_c, next) => {
    if (notFoundReplaced) {
      throw new Error(
        "[@vikejs/hono] app.notFound() was called after vike(app), which replaced the handler that renders Vike's pages. " +
          "Use app.onError() or a route instead, or install the pages yourself: apply(app, [universalHandler]).",
      );
    }
    await next();
  });
}

/**
 * Install every `+middleware` right away, and Vike's pages and not-found page as `app.notFound()`, so that the routes
 * the app registers after `vike(app)` keep their precedence over pages.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareHono[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/hono] vike(app) was already called on this app: call it once.");
  }
  assertNoRouteBefore(app);
  installed.add(app);

  renderPagesOnNotFound(app);
  assertNotFoundNotReplaced(app);

  return apply(app, [...middlewares, ...getUniversalMiddlewares()]);
}
