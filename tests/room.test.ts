import assert from "node:assert/strict";
import test from "node:test";
import { TILE, generateRoom, validateRoom } from "../src/index.js";

test("a seed reproduces byte-for-byte room output", () => {
  assert.deepEqual(generateRoom({ seed: "round-42" }), generateRoom({ seed: "round-42" }));
});

test("generated rooms have a valid wall boundary, doors, and connected interior", () => {
  const room = generateRoom({ seed: "dojo-alpha", width: 13, height: 9, doorCount: 4 });
  assert.equal(room.validation.valid, true);
  assert.equal(room.doors.length, 4);
  assert.equal(room.tiles.length, room.width * room.height);
  assert.equal(validateRoom(room.width, room.height, room.tiles, room.doors).length, 0);
  assert.ok(room.tiles.includes(TILE.DOOR));
});

test("invalid generation options fail before a layout is made", () => {
  assert.throws(() => generateRoom({ seed: "x", width: 10 }), /odd/);
  assert.throws(() => generateRoom({ seed: "x", rulesetVersion: "future" }), /unknown rulesetVersion/);
});
