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
| `W` `A` `S` `D` | walk — or throttle and steer, on the water |
| `Shift` | run |
| `Space` | jump |
| `E` | ride a Yagara Bull or take a boat when near water · dismount when aboard |
| drag, or click | look around — dragging always works; clicking captures the mouse (`Esc` releases) |
| scroll | zoom, from over the shoulder right out to the whole island |
| `M` | top-down layout map |
| `Q` | graphics quality — high / medium / low |
| `N` | music on / off |

## What's here

**The island.** A five-terrace stepped cone rising 120 m, irregular in outline, with
massive ashlar retaining walls broken by four ramps dressed as stepped civic streets.
Roughly 500 buildings of 3–6 storeys, each with recessed windows, shutters, a stone
plinth, a cornice, a door and chimneys — under the half-barrel terracotta vaults, banded
gable arches facing the street, that make a Water 7 skyline recognisable.

**The sky.** A gradient dome with procedural cumulus drifting overhead. A physical sky
model bleached its horizon into a white band that swallowed the sea, and could not give
us clouds — and a deep blue sky stacked with white cumulus is as much a part of how
Water 7 looks as the terracotta roofs are.

**Water, flowing.** One shader drives the sea, the canals and the fountain pools, with a
per-vertex flow direction so the eight radial canals visibly run outward and downward
while the sea drifts and the ring canals ease around. Twenty-five waterfalls pour down
the terrace steps, 14.5 m to 30 m each. The whole network drains from the Great Fountain
at the summit to the sea, which is the thing the island is named for.

**The landmarks.** The Great Fountain — an arcaded drum, three stacked basins each
pouring a full glassy curtain over its rim, and an ice-blue crystalline plume at the
summit. Two flights of stairs and two ring galleries wind up the outside, so you can
climb it and stand behind the falling water 129 m above the sea. Galley-La
Docks 1–7, each entered through a real arched gate carrying its numeral, Dock 1 with a
hull on the stocks. Galley-La HQ, merging both buildings the arc shows. Blue Station with
the Puffing Tom standing at the platform and its trestle running out to the horizon.
Franky House on its spit, robot arms and all, and Scrap Island beyond.

**Street life.** Fifty-four Yagara Bull teams tow gondolas around the ring canals, and
you can climb onto one and ride it. Quayside lamps and bollards, market awnings, crates
and barrels around the yards, laundry strung across the alleys, and boats moored along
every canal.

## How it is put together

The whole island is **one analytic height field**, `heightAt(x, z)`. That single
definition produces the visible mesh, exact player and boat collision with no physics
engine, and the legality test for procedural building and prop placement — so they
cannot disagree with each other.

Navigation is emergent from it: a move is legal if the destination is not water, not
inside anything solid, and not too steep a rise. Terrace walls fail that slope test at
65–77°; the ramps pass it at 15–28°, and their stair treads come from the same shared
definition the renderer draws, so the step you see is the step you stand on. The terrain
material blends paving to stonework by that same slope threshold, so **the island looks
the way it behaves**.

Two rules keep it feeling right: a move is tested **where it lands**, not some fixed
distance ahead of it, and it is split into substeps of 0.25 m so the slope limit means
the same thing at any frame rate. Probing further ahead than the step being taken puts
an invisible wall in front of every slope and ledge on the island.

Because navigability is emergent, it is verified rather than assumed. `npm run verify`
flood-fills the island with the walker's own rules from the spawn point and checks that
26+ hectares are reachable, that the summit and every dock quay can be reached on foot,
and that the landmarks are solid.

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

## Music

*Mother Sea* plays as background music, fading in on your first click (browsers block
audio before a gesture). `N` toggles it, and the choice is remembered.

## Performance

The shadow pass renders the island into a square map every frame regardless of window
size, so it dominates the frame budget — which is why the `Q` quality levels differ
mostly in shadow resolution. None of them removes any of the city; the island is the
same at every setting.

## Reference

Water 7 Arc — manga ch. 322–374, anime ep. 229–263. See `docs/RESEARCH.md` for the
source work and `docs/LAYOUT.md` for the geography, with every number.
