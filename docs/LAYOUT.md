# Water 7 — Layout Plan (top-down)

This is the plan the blockout is built from. Every number here also lives in
`src/world/config.js`, which is the single source of truth the code reads — this
document explains the *reasoning*, the config file holds the values.

## Coordinate system

- Three.js right-handed, **Y up**, world units = **metres**.
- Island centred on the origin.
- Bearing `θ` measured in the XZ plane: `x = r·cos θ`, `z = r·sin θ`.
  `θ = 0°` → **+X (east)**, `θ = 90°` → **+Z (south)**, `θ = 270°` → **−Z (north)**.
- The **main sea approach is from the south (θ = 90°)** — you sail in facing the
  island's showpiece face, exactly as the Straw Hats do.

## Scale

The canon island is enormous. Built 1:1 it would be tedious to cross on foot, so the
blockout uses a **compressed but honest** scale that keeps the silhouette proportions
of the references:

| | value |
|---|---|
| Island radius (shoreline) | **400 m** |
| Summit height | **96 m** |
| Great Fountain spire tip | **~176 m** |
| Sea plane | y = 0 |
| Walk / run speed | 3.6 / 7.6 m·s⁻¹ |
| Rim-to-summit on foot | ≈ 2 min |

Height-to-radius ratio ≈ 1:4.2. The first pass used 1:6.5 and read as a pancake from
the sea; 1:4.2 matches the stepped-cone profile in `Water_7_Infobox` and `hq720`.

## Terraces

Five levels, stepping down from the summit. Each terrace has its **own canal water
level**, 3.5 m below its street surface — the Venetian stone-walled canal look.

| Tier | Name | Radii (m) | Street y | Canal water y |
|---|---|---|---|---|
| 4 | Summit — Great Fountain plaza | 0 – 60 | 96 | 92.5 |
| 3 | Upper city | 60 – 130 | 66 | 62.5 |
| 2 | Civic terrace — **Galley-La HQ** | 130 – 215 | 40 | 36.5 |
| 1 | Main canal residential district | 215 – 310 | 18 | 14.5 |
| 0 | Lower city + **dock ring** | 310 – 400 | 3 | 0 (sea) |
| — | Sea | 400 + | 0 | 0 |

Terrace outlines are **not circles** — they bulge and pinch with a three-harmonic
deviation (±13 m inland, ±5 m at the shoreline). A perfectly concentric island reads as
a machine part; the reference art is irregular.

**Tier 0 is the Aqua Laguna flood zone.** Its street sits only 3 m above the sea; a
surge of 6 m submerges it entirely and stops at the tier-1 retaining wall. The build is
set on a calm afternoon, but the geometry honours the story.

Terrace edges are **massive grey ashlar retaining walls** (the background masonry in
`random-rumble-v0`), broken by ramped corridors so the city is climbable on foot.

**Ramps: θ = 5°, 97.5°, 186.5°, 275°.** Each sits at the midpoint of the widest gap
between neighbouring canals, so no ramp is ever cut by a radial waterway. Ramp runs are
56 m against terrace rises of 15–30 m, i.e. **15°–28°** — walkable. The walls, blended
over 7 m, come out at **65°–77°** and are not. That contrast *is* the island's
navigation logic: there is no hand-placed invisible geometry anywhere.

## Water network

**8 radial canals**, unevenly spaced and unequal in size — four **major** waterways run
the full descent from the fountain plaza and are wide enough for a ship; four **minor**
ones only start partway down:

| θ | starts at r | width | |
|---|---|---|---|
| 30° | 52 | 19 m | major |
| 75° | 218 | 12 m | minor |
| 120° | 52 | 19 m | major |
| 163° | 133 | 14 m | minor |
| 210° | 52 | 19 m | major |
| 250° | 218 | 12 m | minor |
| 300° | 52 | 19 m | major |
| 340° | 133 | 14 m | minor |

Each canal also **meanders** ±2.2–2.6° as it descends rather than running dead straight.
Because each terrace holds its own water level, a radial canal is a **staircase of pools
separated by falls** — the cascades pouring from the base arches in `hq720`.

- **Ring canal, tier 1** (r ≈ 265, 20 m wide) — the grand canal of the residential
  district, the `images (16)` / `random-rumble` view.
- **Ring canal, tier 0** (r ≈ 374, 20 m wide) — the **dock canal**. It runs *outside*
  the dock basins, so the seven yards open directly onto it: a ship comes in from the
  sea through a radial canal, along the ring, and into a numbered gate.

**Boat range:** open sea → radial canals → tier-0 dock canal → every dock mouth, plus
the lower reach of each radial canal. The upper terraces would need locks; the boat
stops at the tier-1 wall. Honest, and still a full circumnavigation plus real canal
running.

**68 arched footbridges** carry the streets over the canals. They are part of the height
field, not decoration — the arch you see is the arch you walk on — and each deck lands
flush with the real ground at its abutments rather than a nominal terrace height.

## Landmark placement

| Landmark | θ | r | Tier | Notes |
|---|---|---|---|---|
| **Great Fountain** | — | 0 | 4 | Tiered spire, summit centre, source of every canal |
| **Dock 1** | 85° | 341 | 0 | Flagship. Heavy gantry crane, drained dry dock, widest gate |
| **Dock 2** | 130° | 341 | 0 | |
| **Dock 3** | 174° | 341 | 0 | |
| **Dock 4** | 220° | 341 | 0 | |
| **Dock 5** | 262.5° | 341 | 0 | |
| **Dock 6** | 310° | 341 | 0 | |
| **Dock 7** | 40° | 341 | 0 | Included for canon completeness (the brief asks 1–6) |
| **Galley-La HQ / Iceburg's office** | 97.5° | 175 | 2 | On the spine, overlooking the harbour — the largest house on the island |
| **Blue Station** | 17° | 388 | 0 | Sea Train terminus; rails run out over open water on a trestle |
| **Market plaza** | 97.5° | 250 | 1 | Stalls, awnings, the busiest street |
| **Franky House** | 52° | 458 | — | Offshore spit off the NE shoulder. Scrap-built, gold lettering, robot arms |
| **Scrap Island** | 62° | 620 | — | Man-made debris heap, open water |
| *(player spawn)* | 92° | 318 | 0 | The quay beside Dock 1, at the foot of the spine |

**Dock bearings are solved, not chosen.** They are the widest-separated set of seven
that clears every radial canal *and* every ramp (minimum separation 42.5°). Basins run
r = 326–356, landward of the dock canal at r ≈ 374.

**The ceremonial spine** is θ = 97.5°: the ramp climbs from the shore past Dock 1 (85°,
just to the side), through the Market Plaza on tier 1, up to Galley-La HQ on tier 2 —
one continuous walk from the flagship yard to the mayor's door.

**Docks 2–7 are extrapolation, not canon** — the series never shows them. They reuse
Dock 1's vocabulary (numbered gate arch, dry dock basin, crane, shed cluster) at varied
scale so they read as siblings rather than copies.

## Top-down sketch

```
                        N (θ=270°)
                    ·  ·  ·  ·  ·  ·
              Dock 6        Dock 7
           (290°)              (330°)
        ·                              ·
                 ,--~~~~~~~--,              Blue Station (10°)
   Dock 5     ,-'   tier 1    '-,          ===== Sea Train rails ==>
   (250°)   ,'   ,--~~~~~--,     ',   ·
        ·  /   ,'  tier 2   ',     \       o Franky House (45°)
          |   |   ,-----,    |      |       \ bridge
  W ------|---|--| SUMMIT|---|------|------ E (θ=0°)
          |   |   ' FTN ,'   |      |        o Scrap Island (55°)
          |   |    '---'     |      |
   Dock 4  \   ',  [HQ]    ,'     /
   (210°)   ',   '--~~~~~-'    ,'
        ·     '-,   tier 0   ,-'
                 '--~~~~~~~-'
           Dock 3          Dock 1  <-- main sea approach
           (170°)          (90°)
                        S (θ=90°)
                    Dock 2 (130°)
```

## Verifying the layout

The island's navigability is *emergent* — it falls out of the height field rather than
being placed by hand — so it is checked rather than assumed:

```
npm run verify
```

`scripts/verify-layout.mjs` asserts that no radial canal runs down a ramp, that every
ramp is walkable shore-to-summit, that every dock basin clears the canals and ramps,
that all 68 bridges span real water and are standable, that the terrace walls hold at
every non-ramp bearing, and that the dock canal threads between the basins and the
shore. All of these currently pass. Four of them did not on the first pass, which is
why the script exists.

## Build order status

1. ✅ Research + this layout plan
2. ✅ **Blockout** — terrain terraces, canal network, water, placeholder massing for
   every landmark in correct relative position
3. ✅ Third-person character controller + collision
4. ✅ Detailed geometry — Great Fountain, Docks 1–7, Galley-La HQ, Blue Station and the
   Puffing Tom, Franky House, Scrap Island, and ~500 detailed residential buildings
5. ✅ Boat + sailing, with `E` to board and step ashore
6. ✅ Flowing water, 25 terrace waterfalls, procedural textures, street props,
   lighting and post-processing

Still open, in rough order of value:

- **Yagara Bulls.** The canal traffic is boats without their seahorse teams. This is the
  most conspicuous missing piece of Water 7's character.
- **Ambient life.** No pedestrians, birds or audio. The city is built but empty.
- **Aqua Laguna.** The flood line is encoded in the geography (tier 0 sits 3 m above the
  sea) but the storm itself is not implemented.
- **Interiors.** Every door and window is exterior dressing; nothing opens.
- **Further de-regularisation.** The plan is far less concentric than the first pass but
  still more orderly than the anime's organic sprawl.
