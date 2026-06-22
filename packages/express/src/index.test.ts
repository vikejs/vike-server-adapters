import express from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("vike/universal-middleware", () => ({ default: () => {} }));

import { toFetchHandler } from "./index.js";

describe("toFetchHandler", () => {
  it("falls back to 404 when the app doesn't handle the request", async () => {
    const app = express();

    const response = await toFetchHandler(app)(new Request("http://localhost/missing"));
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
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

    const payload = JSON.stringify({ hello: "world" });
    const response = await toFetchHandler(app)(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(payload)),
        },
        body: payload,
      }),
    );
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ hello: "world" });
  });
});
