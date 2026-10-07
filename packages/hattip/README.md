# `@vikejs/hattip`

[HatTip](https://github.com/hattipjs/hattip) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/hattip @hattip/router
```

## Usage

Call `vike(app)` before registering your own routes. It installs every `+middleware` right away, so they run on every request, before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for Vike's pages and not-found page to run after all the routes you register later, so your routes keep their precedence over pages.

```ts
import { createRouter } from '@hattip/router'
import vike, { getContext } from '@vikejs/hattip'

const router = createRouter()

vike(router)

router.get('/api/me', (context) => Response.json(getContext(context).user)) // sees what a +middleware added

export default router
```

The pages are added when the router builds its handler (`router.buildHandler()`), after all the routes you registered.

Calling `vike(app)` twice on the same router throws.

You can pass additional [universal middlewares](https://github.com/magne4000/universal-middleware) as the second argument:

```ts
vike(router, [myMiddleware()])
```

## Manual path

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with the two functions Vike exports.

```ts
import { createRouter } from '@hattip/router'
import { apply } from '@vikejs/hattip'
import { getUniversalMiddlewares, universalHandler } from 'vike'

const router = createRouter()

apply(router, getUniversalMiddlewares())
// ... register your routes
apply(router, [universalHandler])

export default router
```

`universalHandler` is Vike's pages and not-found page; it runs no `+middleware`.

This package also re-exports everything from [`@universal-middleware/hattip`](https://github.com/magne4000/universal-middleware).
