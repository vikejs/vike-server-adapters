import { getUniversalProp, orderSymbol, pathSymbol, pipeRoute } from "@universal-middleware/core";
import { type App, apply, createMiddleware } from "@universal-middleware/h3";
import { getUniversalMiddlewares, universalHandler } from "vike";

export * from "@universal-middleware/h3";

type EnhancedMiddlewareH3 = Parameters<typeof apply>[1][number];

const installed = new WeakSet<App>();

/**
 * Install the `+middleware` that are not handlers right away, and the ones that are handlers together with Vike's pages and
 * not-found page when the first request arrives, so that the routes the app registers after `vike(app)` keep their
 * precedence over them. A route registered after the first request sits behind them.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareH3[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/h3] vike(app) was already called on this app: call it once.");
  }
  installed.add(app);

  const universalMiddlewares = getUniversalMiddlewares();
  const handlers = universalMiddlewares.filter(isHandler);

  const onRequest = app.options.onRequest;
  app.options.onRequest = async (event) => {
    app.options.onRequest = onRequest;
    // Not apply(app, [universalHandler]): it would set app.options.onBeforeResponse again, dropping one the app set after vike(app)
    app.use(
      createMiddleware(() => pipeRoute([...handlers, universalHandler], { pipeMiddlewaresInUniversalRoute: false }))(),
    );
    await onRequest?.(event);
  };

  return apply(app, [...middlewares, ...universalMiddlewares.filter((middleware) => !isHandler(middleware))]);
}

// Universal Middleware core's isHandler() is not exported
function isHandler(middleware: Parameters<typeof getUniversalProp>[0]) {
  const order = getUniversalProp(middleware, orderSymbol);
  return typeof order === "number" ? order === 0 : Boolean(getUniversalProp(middleware, pathSymbol));
}
