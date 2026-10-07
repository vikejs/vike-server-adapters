# `@vikejs/express`

[Express](https://expressjs.com) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/express express
```

## Usage

Call `vike(app)` before registering your own routes. It installs every `+middleware` right away, so they run on every request, before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for Vike's pages and not-found page to run after all the routes you register later, so your routes keep their precedence over pages.

```ts
import express from 'express'
import vike, { getContext } from '@vikejs/express'

const app = express()

vike(app)

app.get('/api/me', (req, res) => res.json(getContext(req).user)) // sees what a +middleware added

app.listen(3000)
```

The pages are appended when the first request arrives. A route registered after the first request sits behind the pages, so register every route before `app.listen()`. The same goes for a catch-all handler such as `app.use((req, res) => res.status(404).send('Not found'))` registered after `vike(app)`: it hides the pages, so answer unknown paths with a page instead.

`vike(app)` throws if a route was registered before it, because the `+middleware` would not run for that route: any route other than `OPTIONS` and wildcard paths, and `app.all()` counts. `express.static()`, `cors()`, loggers and `app.options('/{*any}', cors())` are fine. To answer a route before the `+middleware` on purpose, use the manual path.

A body parser registered before `vike(app)`, such as `app.use(express.json())`, needs a [Universal Middleware](https://github.com/magne4000/universal-middleware) release with [#383](https://github.com/magne4000/universal-middleware/pull/383): without it every request that carries a body answers 500. A body parser on a single route registered after `vike(app)` works with the current release.

Calling `vike(app)` twice on the same app throws.

You can pass additional [universal middlewares](https://github.com/magne4000/universal-middleware) as the second argument:

```ts
vike(app, [myMiddleware()])
```

## Manual path

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with the two functions Vike exports.

```ts
import express from 'express'
import { apply, getContext } from '@vikejs/express'
import { getUniversalMiddlewares, universalHandler } from 'vike'

const app = express()

app.get('/health', (req, res) => res.send('ok')) // answered before the +middleware
apply(app, getUniversalMiddlewares())
app.get('/api/me', (req, res) => res.json(getContext(req).user))
apply(app, [universalHandler])

app.listen(3000)
```

`universalHandler` is Vike's pages and not-found page; it runs no `+middleware`.

This package also re-exports everything from [`@universal-middleware/express`](https://github.com/magne4000/universal-middleware).
