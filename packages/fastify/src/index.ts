import { type App, apply } from "@universal-middleware/fastify";
import vikeMiddleware from "vike/universal-middleware";

export * from "@universal-middleware/fastify";
export { toFetchHandler } from "srvx/node";

type EnhancedMiddlewareFastify = Parameters<typeof apply>[1][number];

export default function vike(app: App, middlewares: EnhancedMiddlewareFastify[] = []) {
  return apply(app, [...middlewares, vikeMiddleware]);
}
