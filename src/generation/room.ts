import { GENERATOR_VERSION, RULESET_VERSION, TILE, type Door, type DoorSide, type GenerateRoomInput, type GeneratedRoom, type NormalizedRoomOptions, type Tile } from "../domain/types.js";
import { createRng, deriveSeed, hashSeed } from "./rng.js";
import { getRuleset } from "./ruleset.js";
import { validateRoom } from "./validate.js";

function normalize(input: GenerateRoomInput): NormalizedRoomOptions {
  if (typeof input.seed !== "string" || !input.seed.trim() || input.seed.length > 128) throw new TypeError("seed must be a non-empty string of at most 128 characters");
  const generatorVersion = input.generatorVersion ?? GENERATOR_VERSION;
  const rulesetVersion = input.rulesetVersion ?? RULESET_VERSION;
  if (generatorVersion !== GENERATOR_VERSION) throw new TypeError("unknown generatorVersion");
  const ruleset = getRuleset(rulesetVersion);
  if (!ruleset) throw new TypeError("unknown rulesetVersion");
  const width = input.width ?? 11;
  const height = input.height ?? 11;
  const doorCount = input.doorCount ?? 2;
  for (const [name, value, min, max] of [["width", width, 7, 21], ["height", height, 7, 21], ["doorCount", doorCount, 1, 4]] as const) {
    if (!Number.isInteger(value) || value < min || value > max) throw new TypeError(`${name} must be an integer from ${min} to ${max}`);
  }
  if (width % 2 === 0 || height % 2 === 0) throw new TypeError("width and height must be odd");
  if (Math.max(width / height, height / width) > ruleset.roomDimensions.maximumAspectRatio) throw new TypeError("room aspect ratio must not exceed 2:1");
  return { generatorVersion, rulesetVersion, width, height, doorCount };
}

function contentHash(value: unknown): string {
  return `fnv1a-${hashSeed(JSON.stringify(value)).toString(16).padStart(8, "0")}`;
}

function sideCandidates(side: DoorSide, width: number, height: number): Array<Pick<Door, "x" | "y" | "side">> {
  const candidates = [];
  const length = side === "north" || side === "south" ? width : height;
  for (let coordinate = 2; coordinate <= length - 3; coordinate += 1) {
    candidates.push(side === "north" ? { x: coordinate, y: 0, side } : side === "south" ? { x: coordinate, y: height - 1, side } : side === "west" ? { x: 0, y: coordinate, side } : { x: width - 1, y: coordinate, side });
  }
  return candidates;
}

function pickDoors(seed: string, width: number, height: number, count: number): Door[] {
  const rng = createRng(deriveSeed(seed, "doors"));
  const sides: DoorSide[] = ["north", "east", "south", "west"];
  for (let index = sides.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [sides[index], sides[swap]] = [sides[swap], sides[index]];
  }
  return sides.slice(0, count).map((side, index) => {
    const candidates = sideCandidates(side, width, height);
    if (candidates.length === 0) throw new Error(`No valid door positions available for ${side} side`);
    const position = candidates[Math.floor(rng() * candidates.length)];
    return { id: `door-${index + 1}`, ...position };
  });
}

/** Pure, reproducible room generation. HTTP, MCP, and Worker bindings remain outside this module. */
export function generateRoom(input: GenerateRoomInput): GeneratedRoom {
  const options = normalize(input);
  const tiles: Tile[] = Array.from({ length: options.width * options.height }, (_value, index) => {
    const x = index % options.width;
    const y = Math.floor(index / options.width);
    return x === 0 || x === options.width - 1 || y === 0 || y === options.height - 1 ? TILE.WALL : TILE.FLOOR;
  });
  const doors = pickDoors(input.seed, options.width, options.height, options.doorCount);
  for (const door of doors) tiles[door.y * options.width + door.x] = TILE.DOOR;
  const diagnostics = validateRoom(options.width, options.height, tiles, doors);
  const result = {
    id: `room-${contentHash([input.seed, options]).slice(-8)}`,
    seed: input.seed,
    generatorVersion: options.generatorVersion,
    rulesetVersion: options.rulesetVersion,
    normalizedOptions: options,
    width: options.width,
    height: options.height,
    tiles,
    doors,
    validation: { valid: diagnostics.length === 0, fallbackUsed: false, diagnostics },
  };
  return { ...result, contentHash: contentHash(result) };
}
