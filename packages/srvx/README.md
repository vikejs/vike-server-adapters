# `@vikejs/srvx`

[srvx](https://srvx.unjs.io) server adapter for [Vike](https://vike.dev).

## Installation

```sh
npm install @vikejs/srvx srvx
```

## Usage

```ts
import { serve } from 'srvx'
import vike from '@vikejs/srvx'

serve({ fetch: vike() })
```

`vike()` returns the `fetch` handler of the server: it runs the matching `+middleware` that aren't handlers, then your routes, then the handler `+middleware` and Vike's pages and not-found page.

srvx has no app to register routes on, so your own routes go in the array you pass as the first argument, as [universal handlers](https://github.com/magne4000/universal-middleware) with a `method` and a `path`. They run after the `+middleware` that aren't handlers, read what those put in the context, and win over a page at the same path:

```ts
import { enhance } from '@universal-middleware/core'

const me = enhance((request, context) => Response.json(context.user), { name: 'me', method: 'GET', path: '/api/me' })

serve({ fetch: vike([me]) })
```

## Manual path

`vike()` is the same as applying the `+middleware`, then Vike's pages last, with `globalContext.middlewares`:

```ts
import { apply } from '@vikejs/srvx'
import { getGlobalContext } from 'vike/server'

const globalContext = await getGlobalContext()
if (globalContext.isClientSide) throw new Error('Server only')
const { middlewares } = globalContext
serve({ fetch: apply(middlewares) })
```

`vike(app)` looks the `+middleware` up on every request. To filter or re-order the list you apply yourself, see [`+middleware`](https://vike.dev/renderPage#middleware).

Each element of `middlewares` has an `isHandler` property. The last one is Vike's pages and not-found page, after the `+middleware` that are handlers.

This package also re-exports everything from [`@universal-middleware/srvx`](https://github.com/magne4000/universal-middleware).
