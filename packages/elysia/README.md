# `@vikejs/elysia`

[Elysia](https://elysiajs.com) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/elysia elysia
```

## Usage

Call `vike(app)` before registering your own routes. It installs every `+middleware` right away, so they run on every request, before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for Vike's pages and not-found page to run after all the routes you register later, so your routes keep their precedence over pages.

```ts
import { Elysia } from 'elysia'
import vike from '@vikejs/elysia'

const app = new Elysia()

vike(app)

app.get('/api/me', ({ getContext }) => Response.json(getContext().user)) // sees what a +middleware added

app.listen(3000)
```

The pages are one catch-all route, so Elysia matches the routes you register after `vike(app)` first. A route that returns a plain value instead of a `Response` cannot be post-processed by a `+middleware` that returns a response step: return a `Response` from such routes.

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
