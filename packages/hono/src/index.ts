import { getUniversalProp, orderSymbol, pathSymbol, pipeRoute } from "@universal-middleware/core";
import { type App, apply, createMiddleware } from "@universal-middleware/hono";
import { getUniversalMiddlewares, universalHandler } from "vike";

export * from "@universal-middleware/hono";

type EnhancedMiddlewareHono = Parameters<typeof apply>[1][number];

const installed = new WeakSet<App>();

/**
 * Install the `+middleware` that are not handlers right away, and the ones that are handlers together with Vike's pages
 * and not-found page as `app.notFound()`, so that the routes the app registers after `vike(app)` keep their precedence
 * over them.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareHono[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/hono] vike(app) was already called on this app: call it once.");
  }
  assertNoRouteBefore(app);
  installed.add(app);

  const universalMiddlewares = getUniversalMiddlewares();
  renderHandlersOnNotFound(app, universalMiddlewares.filter(isHandler));
  assertNotFoundNotReplaced(app);

  return apply(app, [...middlewares, ...universalMiddlewares.filter((middleware) => !isHandler(middleware))]);
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

function renderHandlersOnNotFound(app: App, handlers: ReturnType<typeof getUniversalMiddlewares>) {
  const pages = createMiddleware(() =>
    pipeRoute([...handlers, universalHandler], { pipeMiddlewaresInUniversalRoute: false }),
  )();
  app.notFound(async (c) => {
    // A route that matched and answered with `c.notFound()` is answered by Hono, not by a handler or a page
    if (c.req.matchedRoutes.some(isAppRoute)) return c.text("404 Not Found", 404);
    // A request no handler or page answers, such as DELETE, is a 404
    return ((await pages(c, async () => {})) as Response | undefined) ?? c.text("404 Not Found", 404);
  });
}

// Watches the app.notFound() calls made from now on, so it runs after renderPagesOnNotFound()
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

// Universal Middleware core's isHandler() is not exported
function isHandler(middleware: Parameters<typeof getUniversalProp>[0]) {
  const order = getUniversalProp(middleware, orderSymbol);
  return typeof order === "number" ? order === 0 : Boolean(getUniversalProp(middleware, pathSymbol));
}
