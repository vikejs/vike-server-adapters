# `@vikejs/express`

[Express](https://expressjs.com) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/express express
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` that aren't handlers right away, so they run before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for the `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) and Vike's pages and not-found page to run after all the routes you register later, so your routes keep their precedence over them: a route you register later on the same path as a handler answers instead of it.

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

Calling `vike(app)` twice on the same app throws.

You can pass additional [universal middlewares](https://github.com/magne4000/universal-middleware) as the second argument:

```ts
vike(app, [myMiddleware()])
```

## Manual path

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with `globalContext.middlewares`.

```ts
import express from 'express'
import { apply, getContext } from '@vikejs/express'
import assert from 'node:assert'
import { getGlobalContext } from 'vike/server'

const app = express()

app.get('/health', (req, res) => res.send('ok')) // answered before the +middleware
const globalContext = await getGlobalContext()
assert(!globalContext.isClientSide)
const { middlewares } = globalContext
apply(
  app,
  middlewares.filter((m) => !m.isHandler),
)
app.get('/api/me', (req, res) => res.json(getContext(req).user))
apply(
  app,
  middlewares.filter((m) => m.isHandler),
)

app.listen(3000)
```

`vike(app)` looks the `+middleware` up on every request. To filter or re-order the list you apply yourself, see [`+middleware`](https://vike.dev/middleware).

Each element of `middlewares` has an `isHandler` property. The last one is Vike's pages and not-found page, after the `+middleware` that are handlers.

This package also re-exports everything from [`@universal-middleware/express`](https://github.com/magne4000/universal-middleware).
