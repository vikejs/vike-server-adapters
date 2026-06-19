import { describe, expect, it, vi } from "vitest";

vi.mock("vike/universal-middleware", () => ({ default: () => {} }));

import vike, { apply, toFetchHandler } from "./index.js";

describe("@vikejs/fastify exports", () => {
  it("vike is a function", () => {
    expect(typeof vike).toBe("function");
  });

  it("apply is a function", () => {
    expect(typeof apply).toBe("function");
  });

  it("toFetchHandler is a function", () => {
    expect(typeof toFetchHandler).toBe("function");
  });
});
