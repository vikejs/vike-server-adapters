# @vikejs/fastify

## 0.3.0

### Minor Changes

- f6d40d9: feat: use the `@universal-middleware/*` adapters built on `@universal-middleware/core` 0.5

  The `path` of middlewares passed to `vike(app, middlewares)`, or registered with the re-exported `apply()`, now follows the [rou3 v0.12+ (1.x) syntax](https://github.com/h3js/rou3/releases/tag/v0.12.0), aligned with URLPattern: `*` matches the rest of the path, `/` included (use `:name` to match a single segment).

  `@vikejs/hono`, `@vikejs/elysia` and `@vikejs/fastify` now require `hono@^4.13.13`, `elysia@^1.4.30` and `fastify@^5.12.5`, the minimum versions `@universal-middleware/core` 0.5 supports.

## 0.2.5

### Patch Changes

- 3fd0147: fix: bump dependencies

## 0.2.3

### Patch Changes

- 106bcb5: fix: revert `toFetchHandler` wrapping for fastify

## 0.2.2

### Patch Changes

- 0afad6f: fix: bump srvx to avoid deadlock

## 0.2.1

### Patch Changes

- 8f181ff: feat: export toFetchHandler utils

## 0.2.0

### Minor Changes

- f24f3e2: feat: replace addVikeMiddleware with a default vike export

## 0.1.0

### Minor Changes

- 5d479d5: initial release
