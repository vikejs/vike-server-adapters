# `@vikejs/h3`

[H3](https://h3.unjs.io) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/h3 h3
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` that aren't handlers right away, so they run before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for Vike's pages and not-found page (`universalHandler`) to run after all the routes you register later, so your routes keep their precedence over pages. `universalHandler` also runs the `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) next to the pages, so a route you register later on the same path answers instead of them.

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

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with the two functions Vike exports.

```ts
import { createApp } from 'h3'
import { apply } from '@vikejs/h3'
import { getUniversalMiddlewares, universalHandler } from 'vike'

const app = createApp()

apply(app, getUniversalMiddlewares())
// ... register your routes
apply(app, [universalHandler])

export default app
```

`universalHandler` is Vike's pages and not-found page; it also runs the `+middleware` that are handlers, and none of the others.

This package also re-exports everything from [`@universal-middleware/h3`](https://github.com/magne4000/universal-middleware).
