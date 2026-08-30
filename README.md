# Water 7

A peaceful, low-stakes 3D exploration of Water 7 from *One Piece* — no combat, no
quests, no dialogue. Just the island.

> **Status: blockout / layout review.** Geography, massing and the character controller
> are in. Detailed geometry is deliberately held until the layout is signed off.

## Running it

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run verify   # assert the layout invariants still hold
```

## Controls

| | |
|---|---|
| `W` `A` `S` `D` | walk |
| `Shift` | run |
| click | capture the mouse to look around (`Esc` releases) |
| `M` | top-down layout map |
| `L` | toggle landmark labels |

## What's here

- **The island** — a five-terrace stepped cone rising 96 m, irregular in outline, with
  massive ashlar retaining walls broken by four walkable ramps.
- **The water network** — eight uneven, meandering radial canals cascading from the
  summit fountain to the sea, plus the tier-1 grand canal and the tier-0 dock canal.
  Each terrace holds its own water level, so the radial canals are staircases of pools.
- **68 arched footbridges**, part of the height field rather than decoration.
- **Landmarks** — the Great Fountain, Galley-La Docks 1–7, Galley-La HQ / Iceburg's
  office, Blue Station and the Sea Train trestle, Franky House, Scrap Island.
- **~500 buildings** of procedural massing, already carrying the signature half-barrel
  terracotta roofs.

## How it is put together

The whole island is **one analytic height field**, `heightAt(x, z)`. That single
definition produces the visible mesh, exact player collision with no physics engine,
and the legality test for procedural building placement — so they cannot disagree with
each other.

Navigation is emergent from it: a move is legal if the destination is not water, not
inside a building, and not too steep a rise. Terrace walls fail that slope test at
65–77°; the ramps pass it at 15–28°. There is no hand-placed invisible geometry.

Because it is emergent, it is verified rather than assumed — see `npm run verify`.

```
src/world/     config, height field, canal shape, bridges, navigation, city generator
src/components/ island, water, city, bridges, landmarks, player, HUD, map
docs/          RESEARCH.md (source material) · LAYOUT.md (the plan, with numbers)
scripts/       verify-layout.mjs · screenshot.mjs
```

`src/world/config.js` is the single source of truth for the geography. Change a radius
or a bearing there and the terrain, water, buildings, docks and map all follow.

## Next

Detailed landmark geometry (Station → Docks → HQ → Franky House → districts), then the
boat and sailing, then lighting and atmosphere. See the build order in `docs/LAYOUT.md`.

## Reference

Water 7 Arc — manga ch. 322–374, anime ep. 229–263. See `docs/RESEARCH.md`.
