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

`vike(app)` now installs the `+middleware` that aren't handlers right away (one proxy that looks them up on every request, so a `+middleware` you add, remove or edit in `vike dev` needs no restart) and arranges for the `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) and Vike's pages and not-found page to run after the routes the app registers later, so a route the app registers after `vike(app)` on the same path answers instead of them. Routes the app registers after `vike(app)` see what the `+middleware` put in the context and keep their precedence over pages. The signature is unchanged.

- Express and H3: the pages are appended when the first request arrives; a route registered after the first request sits behind the pages.
- Hono: the pages are `app.notFound()`; the adapter throws at the first request if `app.notFound()` was called after `vike(app)`, or if the app was mounted with `app.route()`, which doesn't carry `app.notFound()` over (call `vike(app)` on the parent).
- Express and Hono: `vike(app)` throws if a route was registered before it (the `+middleware` would not run for it).
- Calling `vike(app)` twice on the same app throws.

For more control, apply `globalContext.middlewares` yourself: `const globalContext = await getGlobalContext()` (from `vike/server`), `assert(!globalContext.isClientSide)` (from `node:assert`), `const { middlewares } = globalContext`, then `apply(app, middlewares.filter((m) => !m.isHandler))` first and `apply(app, middlewares.filter((m) => m.isHandler))` last (on Fastify and Elysia, one call: `apply(app, middlewares)`). The list holds every `+middleware` and, as its last element, Vike's pages and not-found page; each element has an `isHandler` property. It is read once: in development, `vike dev` re-evaluates your `+server.js` (or restarts your `+serverEntry.js`) when a `+middleware` changes, and a server you run yourself needs a restart.

Requires the Vike release that ships `globalContext.middlewares` and `plusMiddlewareProxy` as `[the +middleware that aren't handlers, the handlers with the pages]` (exported by `vike/__internal`). With an older Vike, the adapters fail when they are imported.
