# `@vikejs/hattip`

[HatTip](https://github.com/hattipjs/hattip) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/hattip @hattip/router
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` right away, so they run on every request, before your routes, and your routes can read what they put in the context with `getContext()`. The `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) are the exception: they run together with Vike's pages and not-found page, after all the routes you register later, so your routes keep their precedence over them.

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

`universalHandler` is Vike's pages and not-found page; it runs no `+middleware`. The `+middleware` that are handlers run where `apply(router, getUniversalMiddlewares())` is, so a route registered after it can't override them, unlike with `vike(app)`.

This package also re-exports everything from [`@universal-middleware/hattip`](https://github.com/magne4000/universal-middleware).
