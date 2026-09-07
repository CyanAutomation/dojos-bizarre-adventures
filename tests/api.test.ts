import assert from "node:assert/strict";
import test from "node:test";
import { createRestRouter } from "../src/api/router.js";

const router = createRestRouter();

test("GET generation is deterministic and cacheable", async () => {
  const response = await router(new Request("https://example.test/v1/rooms/generate?seed=api-seed&width=11&height=11&doorCount=2"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /must-revalidate/);
  const room = await response.json() as { seed: string; validation: { valid: boolean } };
  assert.equal(room.seed, "api-seed");
  assert.equal(room.validation.valid, true);
});

test("bad API input has a stable 400 error response", async () => {
  const response = await router(new Request("https://example.test/v1/rooms/generate?seed=x&width=10"));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { code: "bad_request", message: "width and height must be odd" } });
});
