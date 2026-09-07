# Dojo's Bizarre Adventures

A procedural dojo/room creator exposed through an API.

## Technology decision

The first implementation should use **TypeScript on Cloudflare Workers**. The
generator is mostly integer-grid manipulation, graph traversal, validation,
and JSON I/O; these are fast in the Workers V8 runtime when tiles are stored
in typed arrays. TypeScript also gives the API direct access to Workers
bindings and the simplest development and test workflow.

Keep the generation engine as a pure TypeScript module, separate from the HTTP
handler. This makes it straightforward to exercise from tests and leaves open
the option of moving a measured CPU hotspot into Rust/Wasm later. Do not start
with Go or Rust: Go is not a first-class Workers authoring environment, while
Rust/Wasm adds build, binary-size, and JavaScript interop costs that are not
justified until profiling shows a need.

Suggested runtime shape:

```txt
HTTP Worker (TypeScript + Hono or equivalent)
  -> pure generator (seeded PRNG, graph, tiles, validation)
  -> Cache API for repeat deterministic requests
  -> D1/KV for persistent or mutable world metadata
```

Rooms should initially be derived from the world seed and a stable room ID or
coordinates, allowing lazy generation without persistence. Store generated
results only when a room becomes mutable (for example, a door is unlocked or
an object is collected).

## Room-model decision

The game world uses a **grid-based room model**. Every room has a rectangular logical grid with integer coordinates (`x`, `y`), which remains the source of truth for generation, collision, connectivity, and eventual rendering. This keeps the generator fast, deterministic, and suitable for both top-down and future isometric views.

### Internal representation

Generation and validation operate on compact numeric tile arrays rather than text characters. For example:

| Value | Meaning |
| ---: | --- |
| `0` | void / unused |
| `1` | wall |
| `2` | floor |
| `3` | door |

Doors, room links, and interactive objects carry separate structured metadata where needed (such as position, orientation, destination, lock state, or contents). This avoids overloading a single tile value as the game grows.

### API and debugging representation

At the API/debugging boundary, rooms may be represented with readable characters so that people can inspect generated layouts easily:

```txt
#####D#####
#.........#
#.........#
#.........#
#####D#####
```

The API must provide a legend that maps each character to its tile meaning. Character grids are rectangular: each row has the declared room width.

### Procedural generation and seeds

Each generated world has a seed and generator version. Given the same seed, generator version, and generation options, the service should reproduce the same layout. The seed supports varied playthroughs, replay/sharing, and reliable bug reproduction.

```json
{
  "seed": 1847392,
  "generatorVersion": "1.0.0",
  "rulesetVersion": "1.0.0",
  "rooms": []
}
```

Generation should first build a room-connection graph, then generate and
validate each room against its local rules—for example, minimum dimensions,
aspect-ratio limits, at least one door, and reachable required doors. Rooms
can be generated lazily as players approach them, while retaining their seed
or generated result so revisiting a room is consistent.

### Randomness and reproducibility

The generator must use an explicit, documented, deterministic pseudo-random
number generator (PRNG), never `Math.random()`. Derive independent random
streams from the world seed, ruleset version, room ID, and purpose (for
example `graph`, `shape`, `doors`, or `objects`). This prevents a change in one
step from accidentally changing unrelated choices.

The complete reproduction key is:

```txt
(seed, generatorVersion, rulesetVersion, normalised generation options)
```

Normalise and validate options before deriving randomness, then return the
normalised options in the API response. A generated result should also expose
its reproduction key and an optional stable content hash.

## Versioned generation rules

Rules are a product contract, not an unversioned configuration file. A
**ruleset version is immutable once released**: future changes create a new
ruleset version, and worlds created under an older version continue to use it.
This preserves shared seeds, replays, regression tests, and bug reports.

`generatorVersion` identifies the generator implementation and serialization
behaviour. `rulesetVersion` identifies the gameplay/layout constraints it
applies. A compatible refactor may retain both versions only if fixture output
is byte-for-byte equivalent; otherwise bump the appropriate version. Never
silently substitute the latest ruleset when an API request or saved world names
an older one.

Recommended release process:

1. Define a candidate ruleset in code and a machine-readable manifest.
2. Generate a fixed seed corpus and record snapshots, validation metrics, and
   content hashes.
3. Review the corpus for playability, variety, and compatibility; then release
   the ruleset under a new immutable version.
4. Keep the previous ruleset executable for existing worlds. Migrations must
   be explicit and create a new world/version rather than alter its past.

### Example ruleset: `1.0.0`

The following deliberately small rule set provides a useful first release. It
is a starting point for balancing, not a promise that later versions cannot
add room types or richer tile data.

| Area | Rule |
| --- | --- |
| World graph | Create 6–12 rooms. The graph is connected, has one designated entrance, and has at least one room at graph distance 3 or greater from it. |
| Room dimensions | Width and height are each 7–21 tiles; both are odd; the aspect ratio is at most 2:1. |
| Boundaries | The outer tile ring is wall. A door occupies a non-corner boundary tile and connects to a floor tile immediately inside the room. |
| Doors | Every non-entrance room has 1–4 doors, exactly matching its allocated graph edges. No two doors may be adjacent or occupy opposite positions that create a one-tile corridor. |
| Floor | At least 35% of tiles inside the boundary are floor, and the floor forms one connected component. Every required door can reach every other required door over floor tiles. |
| Obstacles | Optional internal walls cannot create unreachable required doors, sealed floor pockets, or a passage narrower than one tile. Keep one-tile clearance around each door. |
| Objects | Spawn points and interactables are only placed on floor, never on doors, and must be reachable from every required door. |
| Deterministic retries | A failed candidate consumes a deterministic attempt index and retries up to 32 times. If all attempts fail, use a documented safe rectangular-room fallback. |

The API should report whether a room was generated normally or via fallback,
along with validation diagnostics suitable for development. Production clients
can receive a compact response while a debug mode exposes the character grid,
legend, ruleset version, and reproduction key.

### Candidate API surface

```txt
POST /v1/worlds
  body: { seed?, generatorVersion?, rulesetVersion?, options? }
  returns: world metadata, reproduction key, room graph

GET /v1/worlds/{worldId}/rooms/{roomId}
  returns: dimensions, numeric tiles, door/object metadata, validation summary

GET /v1/rulesets/{rulesetVersion}
  returns: immutable manifest and supported generation options
```

Requesting an unknown or retired ruleset must return a clear error rather than
quietly generating with a different version.
