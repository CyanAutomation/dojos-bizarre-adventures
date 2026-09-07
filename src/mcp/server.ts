import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { GENERATOR_VERSION, RULESET_VERSION } from "../domain/types.js";
import { generateRoom } from "../generation/room.js";
import { dojoRulesV1 } from "../generation/ruleset.js";

const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value });

export function createDojoMcpHandler() {
  return createMcpHandler(() => {
    const server = new McpServer({ name: "dojos-bizarre-adventures", version: "0.1.0" });
    server.registerTool("get_capabilities", { description: "Get supported dojo generation versions and features.", inputSchema: {} }, async () => result({ generatorVersions: [GENERATOR_VERSION], rulesetVersions: [RULESET_VERSION] }));
    server.registerTool("get_ruleset", { description: "Get the immutable dojo generation ruleset.", inputSchema: { version: z.string().default(RULESET_VERSION) } }, async ({ version }) => version === RULESET_VERSION ? result(dojoRulesV1) : ({ content: [{ type: "text" as const, text: `Unknown ruleset version: ${version}` }], isError: true }));
    server.registerTool("generate_room", {
      description: "Generate a deterministic, validated dojo room from a seed.",
      inputSchema: { seed: z.string().min(1).max(128), width: z.number().int().min(7).max(21).optional(), height: z.number().int().min(7).max(21).optional(), doorCount: z.number().int().min(1).max(4).optional(), rulesetVersion: z.string().optional() },
    }, async input => result(generateRoom(input)));
    return server;
  }, { legacy: "stateless" });
}
