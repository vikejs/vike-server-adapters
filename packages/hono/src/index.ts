import { type App, apply } from "@universal-middleware/hono";
import vikeMiddleware from "vike/universal-middleware";

export * from "@universal-middleware/hono";

type EnhancedMiddlewareHono = Parameters<typeof apply>[1][number];

export default function vike(app: App, middlewares: EnhancedMiddlewareHono[] = []) {
  return apply(app, [...middlewares, vikeMiddleware]);
}
