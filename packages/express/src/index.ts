import { type App, apply, connectToWeb } from "@universal-middleware/express";
import vikeMiddleware from "vike/universal-middleware";

export * from "@universal-middleware/express";
export const toFetchHandler = connectToWeb;

type EnhancedMiddlewareExpress = Parameters<typeof apply>[1][number];

/**
 * Attach Vike middleware to an Express.js app
 */
export default function vike(app: App, middlewares: EnhancedMiddlewareExpress[] = []) {
  return apply(app, [...middlewares, vikeMiddleware]);
}
