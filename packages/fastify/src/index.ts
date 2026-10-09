import { enhance, getUniversalProp, methodSymbol } from "@universal-middleware/core";
import { type App, apply } from "@universal-middleware/fastify";
import { getUniversalMiddlewares, universalHandler } from "vike";

export * from "@universal-middleware/fastify";
export { toFetchHandler } from "srvx/node";

// Vike's pages answer the methods its handler declares; any other method gets a 404 instead of an empty 200
const pagesMethods = [getUniversalProp(universalHandler, methodSymbol) ?? []].flat();
const otherMethods = enhance(() => new Response(null, { status: 404 }), {
  name: "vike:other-methods",
  method: (["DELETE", "CONNECT", "TRACE"] as const).filter((method) => !pagesMethods.includes(method)),
  path: "/**",
});

type EnhancedMiddlewareFastify = Parameters<typeof apply>[1][number];

const installed = new WeakSet<App>();

/**
 * Install the `+middleware` that aren't handlers right away, and the handlers with Vike's pages and not-found page as one catch-all route: Fastify matches the
 * routes the app registers after `vike(app)` first.
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareFastify[] = []) {
  if (installed.has(app)) {
    throw new Error("[@vikejs/fastify] vike(app) was already called on this app: call it once.");
  }
  installed.add(app);
  return apply(app, [...middlewares, ...getUniversalMiddlewares(), universalHandler, otherMethods]);
}
