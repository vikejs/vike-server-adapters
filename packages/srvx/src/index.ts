import { enhance, getUniversalProp, methodSymbol } from "@universal-middleware/core";
import { apply } from "@universal-middleware/srvx";
import { getUniversalMiddlewares, universalHandler } from "vike";

export * from "@universal-middleware/srvx";

// Vike's pages answer the methods its handler declares; any other method gets a 404 instead of an error
const pagesMethods = [getUniversalProp(universalHandler, methodSymbol) ?? []].flat();
const otherMethods = enhance(() => new Response(null, { status: 404 }), {
  name: "vike:other-methods",
  method: (["DELETE", "CONNECT", "TRACE"] as const).filter((method) => !pagesMethods.includes(method)),
  path: "/**",
});

type EnhancedMiddlewareSrvx = Parameters<typeof apply>[0][number];

/**
 * The `fetch` handler of the server: the `+middleware` that aren't handlers, then the routes in `middlewares`, then the handlers with Vike's pages and
 * not-found page.
 */
export default function vike(middlewares: EnhancedMiddlewareSrvx[] = []) {
  return apply([...middlewares, ...getUniversalMiddlewares(), universalHandler, otherMethods]);
}
