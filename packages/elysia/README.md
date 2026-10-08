# `@vikejs/elysia`

[Elysia](https://elysiajs.com) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/elysia elysia
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` that aren't handlers right away: the ones that match a request run before your routes, and your routes can read what they put in the context with `getContext()`. The `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) run together with Vike's pages and not-found page, after all the routes you register later, so your routes keep their precedence over them.

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

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with the two functions Vike exports.

```ts
import { Elysia } from 'elysia'
import { apply } from '@vikejs/elysia'
import { getUniversalMiddlewares, universalHandler } from 'vike'

const app = new Elysia()

apply(app, [...getUniversalMiddlewares(), universalHandler])

app.get('/api/me', ({ getContext }) => Response.json(getContext().user))

app.listen(3000)
```

On Elysia the manual path is one call, with both functions: the pages are a catch-all route, so a separate call for the `+middleware` would hide them.

This package also re-exports everything from [`@universal-middleware/elysia`](https://github.com/magne4000/universal-middleware).
