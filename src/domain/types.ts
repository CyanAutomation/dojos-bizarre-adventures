export const TILE = { VOID: 0, WALL: 1, FLOOR: 2, DOOR: 3 } as const;
export type Tile = (typeof TILE)[keyof typeof TILE];

export const GENERATOR_VERSION = "dojo-generator-v1";
export const RULESET_VERSION = "dojo-rules-v1";

export type DoorSide = "north" | "east" | "south" | "west";

export interface GenerateRoomInput {
  seed: string;
  generatorVersion?: string;
  rulesetVersion?: string;
  width?: number;
  height?: number;
  doorCount?: number;
}

export interface NormalizedRoomOptions {
  generatorVersion: string;
  rulesetVersion: string;
  width: number;
  height: number;
  doorCount: number;
}

export interface Door {
  id: string;
  x: number;
  y: number;
  side: DoorSide;
}

export interface RoomValidation {
  valid: boolean;
  fallbackUsed: boolean;
  diagnostics: string[];
}

export interface GeneratedRoom {
  id: string;
  seed: string;
  generatorVersion: string;
  rulesetVersion: string;
  normalizedOptions: NormalizedRoomOptions;
  width: number;
  height: number;
  tiles: Tile[];
  doors: Door[];
  validation: RoomValidation;
  contentHash: string;
}

export interface RulesetManifest {
  version: string;
  roomDimensions: { minimum: number; maximum: number; oddOnly: true; maximumAspectRatio: number };
  doors: { minimum: number; maximum: number; nonCorner: true; nonAdjacent: true };
  floor: { minimumInteriorCoverage: number; connected: true; requiredDoorsReachable: true };
}
