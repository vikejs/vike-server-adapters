# `@vikejs/elysia`

[Elysia](https://elysiajs.com) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/elysia elysia
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` that aren't handlers right away, so they run before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for the `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) and Vike's pages and not-found page to run after all the routes you register later, so your routes keep their precedence over them: a route you register later on the same path as a handler answers instead of it.

```ts
import { Elysia } from 'elysia'
import vike from '@vikejs/elysia'

const app = new Elysia()

vike(app)

app.get('/api/me', ({ getContext }) => Response.json(getContext().user)) // sees what a +middleware added

app.listen(3000)
```

The pages are one catch-all route, so Elysia matches the routes you register after `vike(app)` first. When a `+middleware` returns a response step, a route that returns a plain value instead of a `Response` answers 500, because the step cannot post-process it: return a `Response` from such routes.

A JSON body sent to a route registered after `vike(app)` needs a [Universal Middleware](https://github.com/magne4000/universal-middleware) release with [#383](https://github.com/magne4000/universal-middleware/pull/383): without it the route gets an empty body.

Calling `vike(app)` twice on the same app throws.

You can pass additional [universal middlewares](https://github.com/magne4000/universal-middleware) as the second argument:

```ts
vike(app, [myMiddleware()])
```

## Manual path

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with `globalContext.middlewares`.

```ts
import { Elysia } from 'elysia'
import { apply } from '@vikejs/elysia'
import { getGlobalContext } from 'vike/server'

const app = new Elysia()

const globalContext = await getGlobalContext()
if (globalContext.isClientSide) throw new Error('Server only')
const { middlewares } = globalContext
apply(app, middlewares)

app.get('/api/me', ({ getContext }) => Response.json(getContext().user))

app.listen(3000)
```

`vike(app)` looks the `+middleware` up on every request. To filter or re-order the list you apply yourself, see [`+middleware`](https://vike.dev/renderPage#middleware).

On Elysia the manual path is one call: the pages are a catch-all route, so a separate call for the `+middleware` would hide them. Elysia runs a middleware as a hook before every route, so applied like this the `+middleware` that are handlers run before your routes too, and a route can't override one; `vike(app)` doesn't have this limit.

This package also re-exports everything from [`@universal-middleware/elysia`](https://github.com/magne4000/universal-middleware).
