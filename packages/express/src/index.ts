import { type App, apply, connectToWeb } from "@universal-middleware/express";
import vikeMiddleware from "vike/universal-middleware";

export * from "@universal-middleware/express";

/**
 * Convert an Express app into a web `fetch` handler.
 *
 * `connectToWeb()` resolves to `undefined` when the request is passed through
 * without being handled (Connect's `next()`, or a middleware returning `false`).
 * A terminal `fetch` handler must always return a `Response`, so we fall back to
 * a `404` — mirroring the `nextOr404` convention of `@universal-middleware`'s own
 * handlers. This keeps the return type assignable to `Server['fetch']`.
 *
 * (`@vikejs/express` used to re-export srvx's `toFetchHandler`, but that one
 * deadlocks and doesn't work on Deno/Bun — see srvx#132.)
 */
export function toFetchHandler(app: Parameters<typeof connectToWeb>[0]): (request: Request) => Promise<Response> {
  const handler = connectToWeb(app);
  return async (request) => (await handler(request)) ?? new Response(null, { status: 404 });
}

type EnhancedMiddlewareExpress = Parameters<typeof apply>[1][number];

export default function vike(app: App, middlewares: EnhancedMiddlewareExpress[] = []) {
  return apply(app, [...middlewares, vikeMiddleware]);
}
