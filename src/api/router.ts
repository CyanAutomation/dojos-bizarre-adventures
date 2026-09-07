import { GENERATOR_VERSION, RULESET_VERSION } from "../domain/types.js";
import { generateRoom } from "../generation/room.js";
import { dojoRulesV1 } from "../generation/ruleset.js";
import { json } from "./json-response.js";

const MAX_BODY_BYTES = 16 * 1024;
const CACHE_CONTROL = "public, max-age=300, s-maxage=300, must-revalidate";

async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new TypeError("request body is too large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new TypeError("request body must be valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TypeError("request body must be an object");
  return body as Record<string, unknown>;
}

function generateInput(url: URL): Record<string, unknown> {
  const fields = ["seed", "generatorVersion", "rulesetVersion", "width", "height", "doorCount"] as const;
  return Object.fromEntries(fields.flatMap(field => {
    const value = url.searchParams.get(field);
    return value === null ? [] : [[field, field === "width" || field === "height" || field === "doorCount" ? Number(value) : value]];
  }));
}

export function createRestRouter() {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") return json({ status: "ok" });
    if (request.method === "GET" && url.pathname === "/v1/version") return json({ apiVersion: "v1", generatorVersion: GENERATOR_VERSION, rulesetVersion: RULESET_VERSION }, 200, { "cache-control": "no-cache" });
    if (request.method === "GET" && url.pathname === "/v1/capabilities") return json({ apiVersion: "v1", generatorVersions: [GENERATOR_VERSION], rulesetVersions: [RULESET_VERSION], endpoints: ["generate_room"] }, 200, { "cache-control": CACHE_CONTROL });
    if (request.method === "GET" && url.pathname === `/v1/rulesets/${RULESET_VERSION}`) return json(dojoRulesV1, 200, { "cache-control": CACHE_CONTROL });
    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/v1/rooms/generate") {
      try {
        const input = request.method === "GET" ? generateInput(url) : await requestBody(request);
        return json(generateRoom(input as unknown as Parameters<typeof generateRoom>[0]), 200, request.method === "GET" ? { "cache-control": CACHE_CONTROL } : undefined);
      } catch (error) {
        return json({ error: { code: "bad_request", message: error instanceof Error ? error.message : "invalid request" } }, 400);
      }
    }
    return json({ error: { code: "not_found", message: "route not found" } }, 404);
  };
}
