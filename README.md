# `vikejs/vike-server-adapters`

Server adapters integrating [Vike](https://vike.dev) with various server frameworks.

## Packages

| Package | Framework |
|---|---|
| [`@vikejs/hono`](packages/hono) | [Hono](https://hono.dev) |
| [`@vikejs/express`](packages/express) | [Express](https://expressjs.com) |
| [`@vikejs/fastify`](packages/fastify) | [Fastify](https://fastify.dev) |
| [`@vikejs/h3`](packages/h3) | [H3](https://h3.unjs.io) |
| [`@vikejs/elysia`](packages/elysia) | [Elysia](https://elysiajs.com) |
| [`@vikejs/hattip`](packages/hattip) | [HatTip](https://github.com/hattipjs/hattip) |
| [`@vikejs/srvx`](packages/srvx) | [srvx](https://srvx.unjs.io) |

## Overview

Each package exposes a `vike()` helper that registers Vike's middleware on your server app. They also re-export the full [`@universal-middleware`](https://github.com/magne4000/universal-middleware) API for the corresponding framework.

## Contributing

```sh
pnpm install
pnpm build
```
