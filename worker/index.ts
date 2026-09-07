import { createRestRouter } from "../src/api/router.js";
import { json } from "../src/api/json-response.js";
import { createDojoMcpHandler } from "../src/mcp/server.js";

interface Env { API_KEY?: string; MCP_ALLOWED_HOSTNAMES?: string; REST_ALLOWED_ORIGINS?: string; }
const rest = createRestRouter();
const mcp = createDojoMcpHandler();

function authorized(request: Request, key: string | undefined) {
  const value = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-api-key");
  return Boolean(key && value && value === key);
}
function allowedMcpHost(request: Request, rawHosts: string | undefined) {
  const hosts = (rawHosts ?? "").split(",").map(value => value.trim()).filter(Boolean);
  return hosts.includes(new URL(request.url).hostname);
}
function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  const origins = (env.REST_ALLOWED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  return origin && origins.includes(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" } : {};
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") {
      if (!authorized(request, env.API_KEY)) return json({ error: { code: "unauthorized", message: "a valid API key is required" } }, 401, { "www-authenticate": "Bearer" });
      if (!allowedMcpHost(request, env.MCP_ALLOWED_HOSTNAMES)) return json({ error: { code: "forbidden", message: "MCP hostname is not allowed" } }, 403);
      return mcp.fetch(request);
    }
    const headers = cors(request, env);
    if (request.method === "OPTIONS" && url.pathname.startsWith("/v1/")) return new Response(null, { status: 204, headers });
    const response = await rest(request);
    const responseHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) responseHeaders.set(key, value);
    return new Response(response.body, response);
  },
};
