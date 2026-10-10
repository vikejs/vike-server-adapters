import { type App, apply } from "@universal-middleware/elysia";
import { middlewaresAfterRoutes, middlewaresBeforeRoutes } from "vike/__internal";

export * from "@universal-middleware/elysia";

type EnhancedMiddlewareElysia = Parameters<typeof apply>[1][number];

const installed = new WeakSet<App>();

/**
 * Install the `+middleware` that aren't handlers right away, and the handlers with Vike's pages and not-found page as one catch-all route: Elysia matches the
 * routes the app registers after `vike(app)` first.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareElysia[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/elysia] vike(app) was already called on this app: call it once.");
  }
  installed.add(app);
  return apply(app, [...middlewares, middlewaresBeforeRoutes, middlewaresAfterRoutes]);
}
