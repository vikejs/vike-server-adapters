---
"@vikejs/express": minor
"@vikejs/hono": minor
"@vikejs/fastify": minor
"@vikejs/elysia": minor
"@vikejs/h3": minor
"@vikejs/hattip": minor
"@vikejs/srvx": minor
---

feat: `vike(app)` runs every `+middleware` on every request, before the app's own routes

`vike(app)` now installs every `+middleware` right away (`getUniversalMiddlewares()` from `vike`) and arranges for Vike's pages and not-found page (`universalHandler`) to run after the routes the app registers later. Routes the app registers after `vike(app)` see what the `+middleware` put in the context and keep their precedence over pages. The signature is unchanged.

- Express and H3: the pages are appended when the first request arrives; a route registered after the first request sits behind the pages.
- Hono: the pages are `app.notFound()`; the adapter throws at the first request if `app.notFound()` was called after `vike(app)`.
- Express and Hono: `vike(app)` throws if a route was registered before it (the `+middleware` would not run for it).
- Fastify: a JSON `POST` to a route after `vike(app)` needs a Universal Middleware release containing universal-middleware#383, and `HEAD` requests, redirects and `204` answers need one containing #384; without them these answer 500.
- Express: a body parser registered before `vike(app)`, such as `app.use(express.json())`, needs a Universal Middleware release containing universal-middleware#383; without it requests with a body answer 500.
- Elysia: a JSON body sent to a route after `vike(app)` needs a Universal Middleware release containing universal-middleware#383; without it the route gets an empty body.
- Calling `vike(app)` twice on the same app throws.

For more control, use `apply(app, getUniversalMiddlewares())` first and `apply(app, [universalHandler])` last (on Fastify and Elysia, one call: `apply(app, [...getUniversalMiddlewares(), universalHandler])`). Requires a Vike version that exports `getUniversalMiddlewares` and `universalHandler`.
