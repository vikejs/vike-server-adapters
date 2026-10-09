# `@vikejs/hono`

[Hono](https://hono.dev) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/hono hono
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` that aren't handlers right away, so they run before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for the `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) and Vike's pages and not-found page to run after all the routes you register later, so your routes keep their precedence over them: a route you register later on the same path as a handler answers instead of it.

```ts
import { Hono } from 'hono'
import vike, { getContext } from '@vikejs/hono'

const app = new Hono()

vike(app)

app.get('/api/me', (c) => c.json(getContext(c).user)) // sees what a +middleware added

export default app
```

The pages run as `app.notFound()`. A route that matched and answered with `c.notFound()` is answered by Hono's own not-found response, not by a page. The adapter throws at the first request if `app.notFound()` was called after `vike(app)`, since that replaces Vike's pages. It throws at the first request too if the app was mounted with `app.route()`, which doesn't carry `app.notFound()` over: call `vike(app)` on the parent app.

`vike(app)` throws if a route was registered before it, because the `+middleware` would not run for that route: any route other than `ALL`, `OPTIONS` and wildcard paths (`app.use(logger())`, `app.use(cors())` and `app.get('/static/*', serveStatic())` are fine). To answer a route before the `+middleware` on purpose, use the manual path.

Calling `vike(app)` twice on the same app throws.

You can pass additional [universal middlewares](https://github.com/magne4000/universal-middleware) as the second argument:

```ts
vike(app, [myMiddleware()])
```

## Manual path

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with `globalContext.middlewares`.

```ts
import { Hono } from 'hono'
import { apply, getContext } from '@vikejs/hono'
import { getGlobalContext } from 'vike/server'

const app = new Hono()

app.get('/health', (c) => c.text('ok')) // answered before the +middleware
const globalContext = await getGlobalContext()
if (globalContext.isClientSide) throw new Error('Server only')
const { middlewares } = globalContext
apply(
  app,
  middlewares.filter((m) => !m.isHandler),
)
app.get('/api/me', (c) => c.json(getContext(c).user))
apply(
  app,
  middlewares.filter((m) => m.isHandler),
)

export default app
```

`vike(app)` looks the `+middleware` up on every request. To filter or re-order the list you apply yourself, see [`+middleware`](https://vike.dev/renderPage#middleware).

Each element of `middlewares` has an `isHandler` property. The last one is Vike's pages and not-found page, after the `+middleware` that are handlers.

This package also re-exports everything from [`@universal-middleware/hono`](https://github.com/magne4000/universal-middleware).
