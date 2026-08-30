# Water 7

A peaceful, low-stakes 3D exploration of Water 7 from *One Piece*, in the browser. No
combat, no quests, no dialogue. Just the island — walk it, or take a boat out.

## Running it

```bash
npm install
npm run dev      # http://127.0.0.1:5173

npm run verify   # assert the layout invariants still hold
npm run smoke    # drive the built app: walk, board, sail, step ashore
npm run perf     # frame rate at each graphics setting
```

## Controls

| | |
|---|---|
| `W` `A` `S` `D` | walk — or throttle and steer, in the boat |
| `Shift` | run |
| `E` | board a boat when near water · step ashore when in one |
| click | capture the mouse to look around (`Esc` releases) |
| `M` | top-down layout map |
| `L` | landmark labels |
| `Q` | graphics quality — high / medium / low |

## What's here

**The island.** A five-terrace stepped cone rising 96 m, irregular in outline, with
massive ashlar retaining walls broken by four ramps dressed as stepped civic streets.
Roughly 500 buildings of 3–6 storeys, each with recessed windows, shutters, a stone
plinth, a cornice, a door and chimneys — under the half-barrel terracotta vaults, banded
gable arches facing the street, that make a Water 7 skyline recognisable.

**Water, flowing.** One shader drives the sea, the canals and the fountain pools, with a
per-vertex flow direction so the eight radial canals visibly run outward and downward
while the sea drifts and the ring canals ease around. Twenty-five waterfalls pour down
the terrace steps, 14.5 m to 30 m each. The whole network drains from the Great Fountain
at the summit to the sea, which is the thing the island is named for.

**The landmarks.** The Great Fountain — an arcaded drum under four stacked basins with
curtains falling between them and eight spouts aimed down the eight canals. Galley-La
Docks 1–7, each entered through a real arched gate carrying its numeral, Dock 1 with a
hull on the stocks. Galley-La HQ, merging both buildings the arc shows. Blue Station with
the Puffing Tom standing at the platform and its trestle running out to the horizon.
Franky House on its spit, robot arms and all, and Scrap Island beyond.

**Street life.** Quayside lamps and bollards, market awnings, crates and barrels around
the yards, laundry strung across the alleys, and boats moored along every canal.

## How it is put together

The whole island is **one analytic height field**, `heightAt(x, z)`. That single
definition produces the visible mesh, exact player and boat collision with no physics
engine, and the legality test for procedural building and prop placement — so they
cannot disagree with each other.

Navigation is emergent from it: a move is legal if the destination is not water, not
inside a building, and not too steep a rise. Terrace walls fail that slope test at
65–77°; the ramps pass it at 15–28°. There is no hand-placed invisible geometry. The
terrain material blends paving to stonework by the same slope threshold, so **the island
looks the way it behaves**.

Because navigability is emergent, it is verified rather than assumed — `npm run verify`.

```
src/world/       config · height field · canal shape · bridges · navigation ·
                 city + prop generators · procedural textures · water shaders
src/components/  island · water · waterfalls · city · canal edges · ramps ·
                 landmarks · player · boat · HUD · map
docs/            RESEARCH.md (source material) · LAYOUT.md (the plan, with numbers)
scripts/         verify-layout.mjs · smoke.mjs · perf.mjs · screenshot.mjs
```

`src/world/config.js` is the single source of truth for the geography. Change a radius
or a bearing there and the terrain, water, buildings, docks, props and map all follow.

## Performance

The shadow pass renders the island into a square map every frame regardless of window
size, so it dominates the frame budget — which is why the `Q` quality levels differ
mostly in shadow resolution. None of them removes any of the city; the island is the
same at every setting.

## Reference

Water 7 Arc — manga ch. 322–374, anime ep. 229–263. See `docs/RESEARCH.md` for the
source work and `docs/LAYOUT.md` for the geography, with every number.
