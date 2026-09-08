import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";

test("MCP authentication accepts only the configured API key", async () => {
  const env = { API_KEY: "secret-key", MCP_ALLOWED_HOSTNAMES: "example.test" };

  const unauthorized = await worker.fetch(new Request("https://example.test/mcp", {
    headers: { authorization: "Bearer secret-kex" },
  }), env);
  assert.equal(unauthorized.status, 401);

  const authorized = await worker.fetch(new Request("https://example.test/mcp", {
    method: "POST",
    headers: {
      authorization: "Bearer secret-key",
      "content-type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  }), env);
  assert.notEqual(authorized.status, 401);
});
