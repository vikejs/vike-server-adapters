# `@vikejs/h3`

[H3](https://h3.unjs.io) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/h3 h3
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` that aren't handlers right away, so they run before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for the `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) and Vike's pages and not-found page to run after all the routes you register later, so your routes keep their precedence over them: a route you register later on the same path as a handler answers instead of it.

```ts
import { createApp, createRouter, eventHandler } from 'h3'
import vike, { getContext } from '@vikejs/h3'

const app = createApp()

vike(app)

const router = createRouter()
router.get('/api/me', eventHandler((event) => getContext(event).user)) // sees what a +middleware added
app.use(router)

export default app
```

The pages are appended when the first request arrives. A route registered after the first request sits behind the pages, so register every route before serving requests. A catch-all handler registered after `vike(app)` hides the pages. When a `+middleware` returns a response step, a route that returns a plain object instead of a string or a `Response` answers 500, because the step cannot post-process it: return a `Response` from such routes.

Calling `vike(app)` twice on the same app throws.

You can pass additional [universal middlewares](https://github.com/magne4000/universal-middleware) as the second argument:

```ts
vike(app, [myMiddleware()])
```

## Manual path

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with `globalContext.middlewares`.

```ts
import { createApp } from 'h3'
import { apply } from '@vikejs/h3'
import { getGlobalContext } from 'vike/server'

const app = createApp()

const { middlewares } = await getGlobalContext()
apply(
  app,
  middlewares.filter((m) => !m.isHandler),
)
// ... register your routes
apply(
  app,
  middlewares.filter((m) => m.isHandler),
)

export default app
```

`vike(app)` looks the `+middleware` up on every request. To filter or re-order the list you apply yourself, see [`+middleware`](https://vike.dev/renderPage#middleware).

Each element of `middlewares` has an `isHandler` property. The last one is Vike's pages and not-found page, after the `+middleware` that are handlers.

This package also re-exports everything from [`@universal-middleware/h3`](https://github.com/magne4000/universal-middleware).
