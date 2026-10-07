---
"@vikejs/elysia": minor
"@vikejs/express": minor
"@vikejs/fastify": minor
"@vikejs/h3": minor
"@vikejs/hattip": minor
"@vikejs/hono": minor
"@vikejs/srvx": minor
---

feat: use the `@universal-middleware/*` adapters built on `@universal-middleware/core` 0.5

The `path` of middlewares passed to `vike(app, middlewares)`, or registered with the re-exported `apply()`, now follows the [rou3 v0.12+ (1.x) syntax](https://github.com/h3js/rou3/releases/tag/v0.12.0), aligned with URLPattern: `*` matches the rest of the path, `/` included (use `:name` to match a single segment).

`@vikejs/hono`, `@vikejs/elysia` and `@vikejs/fastify` now require `hono@^4.13.13`, `elysia@^1.4.30` and `fastify@^5.12.5`, the minimum versions `@universal-middleware/core` 0.5 supports.
