# Dojo's Bizarre Adventures

A procedural dojo/room creator exposed through an API.

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
  "generatorVersion": "1.0",
  "rooms": []
}
```

Generation should first build a room-connection graph, then generate and validate each room against its local rules—for example, minimum dimensions, aspect-ratio limits, at least one door, and reachable required doors. Rooms can be generated lazily as players approach them, while retaining their seed or generated result so revisiting a room is consistent.
