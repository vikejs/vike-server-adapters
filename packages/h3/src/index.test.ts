import { describe, expect, it, vi } from "vitest";

vi.mock("vike/universal-middleware", () => ({ default: () => {} }));

import vike, { apply } from "./index.js";

describe("@vikejs/h3 exports", () => {
  it("vike is a function", () => {
    expect(typeof vike).toBe("function");
  });

  it("apply is a function", () => {
    expect(typeof apply).toBe("function");
  });
});
