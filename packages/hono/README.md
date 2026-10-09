# `@vikejs/hono`

[Hono](https://hono.dev) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/hono hono
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` that aren't handlers right away, so they run before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for Vike's pages and not-found page (`universalHandler`) to run after all the routes you register later, so your routes keep their precedence over pages. `universalHandler` also runs the `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) next to the pages, so a route you register later on the same path answers instead of them.

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

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with the two functions Vike exports.

```ts
import { Hono } from 'hono'
import { apply, getContext } from '@vikejs/hono'
import { getUniversalMiddlewares, universalHandler } from 'vike'

const app = new Hono()

app.get('/health', (c) => c.text('ok')) // answered before the +middleware
apply(app, await getUniversalMiddlewares())
app.get('/api/me', (c) => c.json(getContext(c).user))
apply(app, [universalHandler])

export default app
```

`vike(app)` looks the `+middleware` up on every request, so adding, removing or editing one in `vike dev` needs no restart. The list you apply yourself is read once, when you call `getUniversalMiddlewares()`: restart your server to pick up a change. Being a plain list, it can be filtered and re-ordered; your server stops at the first `+middleware` that answers, so one that must see every response needs an `order` before it.

`universalHandler` is Vike's pages and not-found page; it also runs the `+middleware` that are handlers, and none of the others.

This package also re-exports everything from [`@universal-middleware/hono`](https://github.com/magne4000/universal-middleware).
