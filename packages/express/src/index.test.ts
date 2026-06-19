import express from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("vike/universal-middleware", () => ({ default: () => {} }));

import { connectToWeb, toFetchHandler } from "./index.js";

describe("toFetchHandler", () => {
  it("is connectToWeb", () => {
    expect(toFetchHandler).toBe(connectToWeb);
  });

  it("handles GET request", async () => {
    const app = express();
    app.get("/ping", (_req, res) => {
      res.send("pong");
    });

    const response = await toFetchHandler(app)(new Request("http://localhost/ping"));
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("pong");
  });

  it("handles POST with JSON body on synthetic path (regression: no body double-read)", async () => {
    const app = express();
    app.use(express.json());
    app.post("/echo", (req, res) => {
      res.json(req.body);
    });

    const response = await toFetchHandler(app)(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hello: "world" }),
      }),
    );
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ hello: "world" });
  });
});
