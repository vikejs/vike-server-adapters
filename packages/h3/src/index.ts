import { getUniversalProp, methodSymbol } from "@universal-middleware/core";
import { type App, apply, createHandler } from "@universal-middleware/h3";
import { eventHandler } from "h3";
import { getUniversalMiddlewares, universalHandler } from "vike";

export * from "@universal-middleware/h3";

type EnhancedMiddlewareH3 = Parameters<typeof apply>[1][number];

// Vike's pages answer the methods its handler declares, not DELETE for example
const pagesMethods: string[] = [getUniversalProp(universalHandler, methodSymbol) ?? []].flat();

const installed = new WeakSet<App>();

/**
 * Install every `+middleware` right away, and Vike's pages and not-found page when the first request arrives, so that the
 * routes the app registers after `vike(app)` keep their precedence over pages. A route registered after the first
 * request sits behind the pages.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareH3[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/h3] vike(app) was already called on this app: call it once.");
  }
  installed.add(app);

  const onRequest = app.options.onRequest;
  app.options.onRequest = async (event) => {
    app.options.onRequest = onRequest;
    const pages = createHandler(() => universalHandler)();
    app.use(eventHandler((event) => (pagesMethods.includes(event.method) ? pages(event) : undefined)));
    await onRequest?.(event);
  };

  return apply(app, [...middlewares, ...getUniversalMiddlewares()]);
}
