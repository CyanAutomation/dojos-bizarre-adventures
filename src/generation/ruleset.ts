import { RULESET_VERSION, type RulesetManifest } from "../domain/types.js";

export const dojoRulesV1: RulesetManifest = {
  version: RULESET_VERSION,
  roomDimensions: { minimum: 7, maximum: 21, oddOnly: true, maximumAspectRatio: 2 },
  doors: { minimum: 1, maximum: 4, nonCorner: true, nonAdjacent: true },
  floor: { minimumInteriorCoverage: 0.35, connected: true, requiredDoorsReachable: true },
};

export function getRuleset(version: string): RulesetManifest | undefined {
  return version === RULESET_VERSION ? dojoRulesV1 : undefined;
}
