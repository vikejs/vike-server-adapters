import { getUniversalProp, orderSymbol, pathSymbol } from "@universal-middleware/core";
import { type App, apply } from "@universal-middleware/hattip";
import { getUniversalMiddlewares, universalHandler } from "vike";

export * from "@universal-middleware/hattip";

type EnhancedMiddlewareHattip = Parameters<typeof apply>[1][number];

const installed = new WeakSet<App>();

/**
 * Install the `+middleware` that are not handlers right away, and the ones that are handlers together with Vike's pages
 * and not-found page when the router builds its handler, so that the routes the app registers after `vike(app)` keep
 * their precedence over them.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareHattip[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/hattip] vike(app) was already called on this app: call it once.");
  }
  installed.add(app);

  const universalMiddlewares = getUniversalMiddlewares();
  const handlers = universalMiddlewares.filter(isHandler);

  const buildHandler = app.buildHandler;
  app.buildHandler = function (this: App) {
    app.buildHandler = buildHandler;
    apply(app, [...handlers, universalHandler]);
    return buildHandler.call(this);
  };

  return apply(app, [...middlewares, ...universalMiddlewares.filter((middleware) => !isHandler(middleware))]);
}

// Universal Middleware core's isHandler() is not exported
function isHandler(middleware: Parameters<typeof getUniversalProp>[0]) {
  const order = getUniversalProp(middleware, orderSymbol);
  return typeof order === "number" ? order === 0 : Boolean(getUniversalProp(middleware, pathSymbol));
}
