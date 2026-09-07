import { TILE, type Door, type Tile } from "../domain/types.js";

function tileAt(tiles: readonly Tile[], width: number, x: number, y: number) {
  const index = y * width + x;
  if (index < 0 || index >= tiles.length) return undefined;
  return tiles[index];
}

function inward(door: Door) {
  if (door.side === "north") return [door.x, door.y + 1] as const;
  if (door.side === "south") return [door.x, door.y - 1] as const;
  if (door.side === "west") return [door.x + 1, door.y] as const;
  return [door.x - 1, door.y] as const;
}

export function validateRoom(width: number, height: number, tiles: readonly Tile[], doors: readonly Door[]): string[] {
  const diagnostics: string[] = [];
  if (tiles.length !== width * height) diagnostics.push("tile array does not match declared dimensions");
  if (doors.length === 0) diagnostics.push("room must have at least one door");
  for (const door of doors) {
    const onBoundary = door.x === 0 || door.x === width - 1 || door.y === 0 || door.y === height - 1;
    const corner = (door.x === 0 || door.x === width - 1) && (door.y === 0 || door.y === height - 1);
    const [insideX, insideY] = inward(door);
    if (!onBoundary || corner) diagnostics.push(`door ${door.id} is not a non-corner boundary tile`);
    if (tileAt(tiles, width, door.x, door.y) !== TILE.DOOR) diagnostics.push(`door ${door.id} is missing from tiles`);
    if (tileAt(tiles, width, insideX, insideY) !== TILE.FLOOR) diagnostics.push(`door ${door.id} does not lead to floor`);
  }
  const starts = doors.map(inward);
  if (starts.length) {
    const visited = new Set<string>();
    const queue = [starts[0]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;
      if (visited.has(key) || tileAt(tiles, width, x, y) !== TILE.FLOOR) continue;
      visited.add(key);
      for (const [nextX, nextY] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) queue.push([nextX, nextY]);
      }
    }
    for (const [x, y] of starts) if (!visited.has(`${x},${y}`)) diagnostics.push("required doors are not mutually reachable");
  }
  return diagnostics;
}
