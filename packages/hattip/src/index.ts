import { type App, apply } from "@universal-middleware/hattip";
import { getUniversalMiddlewares, universalHandler } from "vike";

export * from "@universal-middleware/hattip";

type EnhancedMiddlewareHattip = Parameters<typeof apply>[1][number];

const installed = new WeakSet<App>();

/**
 * Install the `+middleware` that aren't handlers right away, and the handlers with Vike's pages and not-found page when the router builds its handler, so
 * that the routes the app registers after `vike(app)` keep their precedence over pages.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareHattip[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/hattip] vike(app) was already called on this app: call it once.");
  }
  installed.add(app);

  const buildHandler = app.buildHandler;
  app.buildHandler = function (this: App) {
    app.buildHandler = buildHandler;
    apply(app, [universalHandler]);
    return buildHandler.call(this);
  };

  return apply(app, [...middlewares, ...getUniversalMiddlewares()]);
}
