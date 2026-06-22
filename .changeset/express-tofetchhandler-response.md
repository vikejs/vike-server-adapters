---
"@vikejs/express": patch
---

fix: make `toFetchHandler` always resolve to a `Response`

Since `0.2.3`, `toFetchHandler` is built on `connectToWeb`, whose `WebHandler` can resolve to `undefined` (the "no middleware handled the request" signal). That `undefined` is not assignable to `Server['fetch']`, breaking the documented `fetch: toFetchHandler(app)` pattern.

`toFetchHandler` now wraps `connectToWeb` with a `404` fallback so it always resolves to a `Response` (mirroring `@universal-middleware`'s own `nextOr404` convention), while keeping the cancel-event propagation that motivated the move away from srvx's `toFetchHandler`.
