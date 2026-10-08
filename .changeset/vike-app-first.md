---
"@vikejs/express": minor
"@vikejs/hono": minor
"@vikejs/fastify": minor
"@vikejs/elysia": minor
"@vikejs/h3": minor
"@vikejs/hattip": minor
"@vikejs/srvx": minor
---

feat: `vike(app)` runs the matching `+middleware` that aren't handlers before the app's routes; handlers and Vike's pages run after them

`vike(app)` now installs the `+middleware` that aren't handlers right away (`getUniversalMiddlewares()` from `vike`) and arranges for Vike's pages and not-found page (`universalHandler`) to run after the routes the app registers later. Routes the app registers after `vike(app)` see what the `+middleware` put in the context and keep their precedence over pages. The signature is unchanged.

- A `+middleware` that is a handler (`order: 0`, or a `path` and no `order`; Universal Middleware core 0.6's `isHandler`) is installed together with the pages instead of right away, so a route the app registers after `vike(app)` on the same path answers instead of it (Telefunc's `/_telefunc`). Every other `+middleware` still runs first. Requires `@universal-middleware/core` 0.6.
- Express and H3: the handlers and the pages are appended when the first request arrives; a route registered after the first request sits behind the pages.
- Hono: the handlers and the pages are `app.notFound()`; the adapter throws at the first request if `app.notFound()` was called after `vike(app)`, or if the app was mounted with `app.route()`, which doesn't carry `app.notFound()` over (call `vike(app)` on the parent).
- Express and Hono: `vike(app)` throws if a route was registered before it (the `+middleware` would not run for it).
- Fastify: a route that reads `getContext()` after an `await` needs a Universal Middleware release containing universal-middleware#382; without it the route can see the context of another request. A JSON `POST` to a route after `vike(app)` answers 500 without a Universal Middleware release containing universal-middleware#383. Without one containing #384, once a `+middleware` changes the response (CORS and cookies do), `HEAD` requests answer 500, redirects and `204` answers turn into 404s, and an unknown path answers 404 and then kills the process.
- A `+middleware` with a `path` needs a Universal Middleware release containing universal-middleware#385: without it a request that spells the path percent-encoded (`/%64ash` for `/dash`) skips that `+middleware`, an auth check for example.
- Express: a body parser registered before `vike(app)`, such as `app.use(express.json())`, needs a Universal Middleware release containing universal-middleware#383; without it requests whose body the parser consumed answer 500.
- Elysia: a JSON body sent to a route after `vike(app)` needs a Universal Middleware release containing universal-middleware#383; without it the route gets an empty body.
- Calling `vike(app)` twice on the same app throws.

For more control, use `apply(app, getUniversalMiddlewares())` first and `apply(app, [universalHandler])` last (on Fastify and Elysia, one call: `apply(app, [...getUniversalMiddlewares(), universalHandler])`). The handlers in `getUniversalMiddlewares()` run where they are applied: on Hono, H3 and HatTip a route registered after that call can't override them; on Express a route registered in the same tick still does, a later one can't; on Fastify and Elysia the router decides, so a route on the same path overrides them; srvx has no app routes, so they run in the order of the array. Requires a Vike version that exports `getUniversalMiddlewares` and `universalHandler`.
