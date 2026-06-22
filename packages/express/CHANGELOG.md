# @vikejs/express

## 0.2.4

### Patch Changes

- 63ea32d: fix: make `toFetchHandler` always resolve to a `Response`

  Since `0.2.3`, `toFetchHandler` is built on `connectToWeb`, whose `WebHandler` can resolve to `undefined` (the "no middleware handled the request" signal). That `undefined` is not assignable to `Server['fetch']`, breaking the documented `fetch: toFetchHandler(app)` pattern.

  `toFetchHandler` now wraps `connectToWeb` with a `404` fallback so it always resolves to a `Response` (mirroring `@universal-middleware`'s own `nextOr404` convention), while keeping the cancel-event propagation that motivated the move away from srvx's `toFetchHandler`.

## 0.2.3

### Patch Changes

- 3fd0147: fix: bump dependencies
- 3fd0147: fix: propagate cancel event

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
