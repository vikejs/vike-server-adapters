# `@vikejs/fastify`

[Fastify](https://fastify.dev) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/fastify fastify
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` right away, so they run on every request, before your routes, and your routes can read what they put in the context with `getContext()`. The `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) are the exception: they run together with Vike's pages and not-found page, after all the routes you register later, so your routes keep their precedence over them.

```ts
import Fastify from 'fastify'
import vike, { getContext } from '@vikejs/fastify'

const app = Fastify()

await vike(app)

app.get('/api/me', (request) => getContext(request).user) // sees what a +middleware added

await app.listen({ port: 3000 })
```

Routes that read `getContext()` after an `await` need a [Universal Middleware](https://github.com/magne4000/universal-middleware) release with [#382](https://github.com/magne4000/universal-middleware/pull/382); without it they can see the context of another request. JSON `POST` requests to your routes need one with [#383](https://github.com/magne4000/universal-middleware/pull/383), or they answer 500. Once a `+middleware` changes the response (CORS and cookies do), you also need one with [#384](https://github.com/magne4000/universal-middleware/pull/384): without it `HEAD` answers 500, redirects and `204` answers turn into 404s, and an unknown path answers 404 and then kills the process.

The pages are one catch-all route, so Fastify matches the routes you register after `vike(app)` first.

The `+middleware` run in a `preHandler` hook, after Fastify parsed the body: a request Fastify cannot parse, such as an `application/octet-stream` body without a parser, answers 415 before they run.

Calling `vike(app)` twice on the same app throws.

You can pass additional [universal middlewares](https://github.com/magne4000/universal-middleware) as the second argument:

```ts
await vike(app, [myMiddleware()])
```

## Manual path

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with the two functions Vike exports.

```ts
import Fastify from 'fastify'
import { apply, getContext } from '@vikejs/fastify'
import { getUniversalMiddlewares, universalHandler } from 'vike'

const app = Fastify()

await apply(app, [...getUniversalMiddlewares(), universalHandler])

app.get('/api/me', (request) => getContext(request).user)

await app.listen({ port: 3000 })
```

On Fastify the manual path is one call, with both functions: the pages are a catch-all route, so two separate calls would register it twice.

This package also re-exports everything from [`@universal-middleware/fastify`](https://github.com/magne4000/universal-middleware).
