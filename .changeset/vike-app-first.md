---
"@vikejs/express": minor
"@vikejs/hono": minor
"@vikejs/fastify": minor
"@vikejs/elysia": minor
"@vikejs/h3": minor
"@vikejs/hattip": minor
"@vikejs/srvx": minor
---

feat: `vike(app)` runs the `+middleware` that aren't handlers before the app's own routes; handlers run with the pages after them

`vike(app)` now installs the `+middleware` that aren't handlers right away (one proxy that looks them up on every request, so a `+middleware` you add, remove or edit in `vike dev` needs no restart) and arranges for Vike's pages and not-found page (`universalHandler`) to run after the routes the app registers later. `universalHandler` also runs the `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`), next to the pages, so a route the app registers after `vike(app)` on the same path answers instead of them. Routes the app registers after `vike(app)` see what the `+middleware` put in the context and keep their precedence over pages. The signature is unchanged.

- Express and H3: the pages are appended when the first request arrives; a route registered after the first request sits behind the pages.
- Hono: the pages are `app.notFound()`; the adapter throws at the first request if `app.notFound()` was called after `vike(app)`, or if the app was mounted with `app.route()`, which doesn't carry `app.notFound()` over (call `vike(app)` on the parent).
- Express and Hono: `vike(app)` throws if a route was registered before it (the `+middleware` would not run for it).
- Fastify: a route that reads `getContext()` after an `await` needs a Universal Middleware release containing universal-middleware#382; without it the route can see the context of another request. A JSON `POST` to a route after `vike(app)` answers 500 without a Universal Middleware release containing universal-middleware#383. Without one containing #384, once a `+middleware` changes the response (CORS and cookies do), `HEAD` requests answer 500, redirects and `204` answers turn into 404s, and an unknown path answers 404 and then kills the process.
- A `+middleware` with a `path` needs a Universal Middleware release containing universal-middleware#385: without it a request that spells the path percent-encoded (`/%64ash` for `/dash`) skips that `+middleware`, an auth check for example.
- Express: a body parser registered before `vike(app)`, such as `app.use(express.json())`, needs a Universal Middleware release containing universal-middleware#383; without it requests whose body the parser consumed answer 500.
- Elysia: a JSON body sent to a route after `vike(app)` needs a Universal Middleware release containing universal-middleware#383; without it the route gets an empty body.
- Calling `vike(app)` twice on the same app throws.

For more control, use `apply(app, await getUniversalMiddlewares())` first and `apply(app, [universalHandler])` last (on Fastify and Elysia, one call: `apply(app, [...(await getUniversalMiddlewares()), universalHandler])`). `getUniversalMiddlewares()` returns a plain list of the `+middleware` that aren't handlers, to filter or re-order, read once: restart your server to pick up a changed `+middleware`. Requires a Vike version where `getUniversalMiddlewares` is async and excludes the handlers, `universalHandler` runs them, and `vike/__internal` exports the proxy.
