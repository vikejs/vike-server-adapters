# `@vikejs/fastify`

[Fastify](https://fastify.dev) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/fastify fastify
```

## Usage

Call `vike(app)` before registering your own routes. It installs the `+middleware` that aren't handlers right away, so they run before your routes, and your routes can read what they put in the context with `getContext()`. It also arranges for the `+middleware` that are handlers (`order: 0`, or a `path` and no `order`, such as Telefunc's `/_telefunc`) and Vike's pages and not-found page to run after all the routes you register later, so your routes keep their precedence over them: a route you register later on the same path as a handler answers instead of it.

```ts
import Fastify from 'fastify'
import vike, { getContext } from '@vikejs/fastify'

const app = Fastify()

await vike(app)

app.get('/api/me', (request) => getContext(request).user) // sees what a +middleware added

await app.listen({ port: 3000 })
```

The pages are one catch-all route, so Fastify matches the routes you register after `vike(app)` first.

The `+middleware` run in a `preHandler` hook, after Fastify parsed the body: a request Fastify cannot parse, such as an `application/octet-stream` body without a parser, answers 415 before they run.

Calling `vike(app)` twice on the same app throws.

You can pass additional [universal middlewares](https://github.com/magne4000/universal-middleware) as the second argument:

```ts
await vike(app, [myMiddleware()])
```

## Manual path

For more control, do by hand what `vike(app)` does: install the `+middleware` first and Vike's pages last, with `globalContext.middlewares`.

```ts
import Fastify from 'fastify'
import { apply, getContext } from '@vikejs/fastify'
import { getGlobalContext } from 'vike/server'

const app = Fastify()

const globalContext = await getGlobalContext()
if (globalContext.isClientSide) throw new Error('Server only')
const { middlewares } = globalContext
await apply(app, middlewares)

app.get('/api/me', (request) => getContext(request).user)

await app.listen({ port: 3000 })
```

`vike(app)` looks the `+middleware` up on every request. To filter or re-order the list you apply yourself, see [`+middleware`](https://vike.dev/renderPage#middleware).

On Fastify the manual path is one call: the pages are a catch-all route, so two separate calls would register it twice. Fastify runs a middleware as a hook before every route, so applied like this the `+middleware` that are handlers run before your routes too, and a route can't override one; `vike(app)` doesn't have this limit.

This package also re-exports everything from [`@universal-middleware/fastify`](https://github.com/magne4000/universal-middleware).
