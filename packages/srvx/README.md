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

`vike()` returns the `fetch` handler of the server: it runs every `+middleware` on every request, then Vike's pages and not-found page.

srvx has no app to register routes on, so your own routes go in the array you pass as the first argument, as [universal handlers](https://github.com/magne4000/universal-middleware) with a `method` and a `path`. They run after the `+middleware`, read what the `+middleware` put in the context, and win over a page at the same path:

```ts
import { enhance } from '@universal-middleware/core'

const me = enhance((request, context) => Response.json(context.user), { name: 'me', method: 'GET', path: '/api/me' })

serve({ fetch: vike([me]) })
```

## Manual path

`vike()` is the same as applying the `+middleware` first and Vike's pages last, with the two functions Vike exports:

```ts
import { apply } from '@vikejs/srvx'
import { getUniversalMiddlewares, universalHandler } from 'vike'

serve({ fetch: apply([...getUniversalMiddlewares(), universalHandler]) })
```

`universalHandler` is Vike's pages and not-found page; it runs no `+middleware`.

This package also re-exports everything from [`@universal-middleware/srvx`](https://github.com/magne4000/universal-middleware).
