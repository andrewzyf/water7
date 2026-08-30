/**
 * Water 7 — world layout constants.
 *
 * Single source of truth for the island's geography. Everything in docs/LAYOUT.md
 * is expressed here; change a number here and the terrain, water, buildings, docks
 * and map view all follow.
 *
 * Coordinates: Y up, metres. Bearing t: x = r*cos(t), z = r*sin(t).
 * t = 0deg -> +X (east), t = 90deg -> +Z (south, the main sea approach).
 */

export const DEG = Math.PI / 180

/** Polar -> world XZ. */
export const polar = (r, degrees) => [
  r * Math.cos(degrees * DEG),
  r * Math.sin(degrees * DEG),
]

/**
 * Yaw values for placing a building on the island's radial grid.
 *
 * Named rather than written inline because getting the sign wrong silently turns a
 * facade to face the mountain instead of the harbour, which is invisible in code and
 * obvious on screen.
 *
 * `outwardYaw` puts the object's local +Z radially outward — downhill, toward the sea.
 * `inwardYaw` puts local +Z radially inward — uphill, toward the summit.
 * In both, local X runs tangentially, along the terrace street.
 */
export const outwardYaw = (bearingDeg) => (90 - bearingDeg) * DEG
export const inwardYaw = (bearingDeg) => -(bearingDeg + 90) * DEG

export const SEA_LEVEL = 0
export const ISLAND_RADIUS = 400
export const SUMMIT_HEIGHT = 120

/**
 * Terraces, summit-first. `outer` is the radius at which the terrace ends and the
 * retaining wall drops to the next one down. Each terrace carries its own canal
 * water level, 3.5 m below its street.
 */
export const TIERS = [
  { id: 4, name: 'Summit — Great Fountain Plaza', inner: 0, outer: 60, y: 120 },
  { id: 3, name: 'Upper City', inner: 60, outer: 130, y: 84 },
  { id: 2, name: 'Civic Terrace', inner: 130, outer: 215, y: 52 },
  { id: 1, name: 'Canal District', inner: 215, outer: 310, y: 24 },
  { id: 0, name: 'Lower City & Dock Ring', inner: 310, outer: 400, y: 3 },
]

export const CANAL_DEPTH = 3.5 // street surface down to water
export const tierAt = (r) => TIERS.find((t) => r < t.outer) ?? null
export const tierById = (id) => TIERS.find((t) => t.id === id)
export const canalWaterY = (tier) => (tier.id === 0 ? SEA_LEVEL : tier.y - CANAL_DEPTH)

/** Width of the blended slope at a terrace edge. Narrow = cliff-like retaining wall. */
export const TERRACE_BLEND = 7
/**
 * Bearings where the terrace edge opens into a long walkable ramp instead of a wall.
 * Deliberately offset 13deg from every radial-canal bearing so a ramp never lands in
 * a canal. 103deg is the ceremonial spine: Dock 1 -> Market Plaza -> Galley-La HQ.
 */
export const RAMP_BEARINGS = [5, 97.5, 186.5, 275]
export const RAMP_HALF_WIDTH = 11 // degrees of arc — stays clear of the canals
export const RAMP_BLEND = 70      // metres of run — keeps every ramp under 28deg

/**
 * The radial canals cascading toward the sea.
 *
 * Deliberately uneven: four major waterways run the whole way from the fountain
 * plaza and are wide enough for a ship, four minor ones only start partway down.
 * Bearings are spaced irregularly and kept at least 16deg clear of every ramp, so no
 * ramp is ever cut by a canal.
 */
export const RADIAL_CANALS = {
  channels: [
    { bearing: 30,  inner: 52,  halfWidth: 9.5, meander: 2.2, seed: 0.4, major: true },
    { bearing: 75,  inner: 218, halfWidth: 6.0, meander: 2.6, seed: 1.9 },
    { bearing: 120, inner: 52,  halfWidth: 9.5, meander: 2.2, seed: 3.3, major: true },
    { bearing: 163, inner: 133, halfWidth: 7.0, meander: 2.4, seed: 4.8 },
    { bearing: 210, inner: 52,  halfWidth: 9.5, meander: 2.2, seed: 0.9, major: true },
    { bearing: 250, inner: 218, halfWidth: 6.0, meander: 2.6, seed: 2.6 },
    { bearing: 300, inner: 52,  halfWidth: 9.5, meander: 2.2, seed: 5.4, major: true },
    { bearing: 340, inner: 133, halfWidth: 7.0, meander: 2.4, seed: 3.9 },
  ],
  /** Widest half-width present, used for coarse rejection tests. */
  maxHalfWidth: 9.5,
}

/**
 * Ring canals. Tier 1 is the grand canal of the residential district; tier 0 is the
 * working dock canal, which runs *outside* the dock basins so the seven yards open
 * directly onto it — ships come in from the sea through the radial canals, along the
 * ring, and into a numbered gate.
 */
export const RING_CANALS = [
  { tier: 1, radius: 265, halfWidth: 10 },
  { tier: 0, radius: 374, halfWidth: 10 },
]

/**
 * The Great Fountain.
 *
 * `basinRadius` is the widest basin, not the monument's footprint — the arcaded drum
 * beneath it is wider, and the plaza has to stay walkable around all of it. When the
 * basin filled the whole summit there was no plaza left and the summit was unreachable
 * on foot.
 */
export const GREAT_FOUNTAIN = {
  basinRadius: 30,
  drumRadius: 34,   // the arcade at the base; nothing solid extends past this
  spireHeight: 96,  // above the summit plaza, putting the tip near 215 m absolute
}

/**
 * The seven Galley-La dry docks, evenly spaced from the main sea approach.
 * Dock 1 is canon; 2-7 are extrapolated from it (see docs/RESEARCH.md).
 */
/**
 * The seven Galley-La dry docks, ringing the lower city.
 *
 * Bearings are not decorative: they are the widest-separated set that clears every
 * radial canal and every ramp (see scripts/verify-layout.mjs, which asserts it).
 * Dock 1 is canon; 2-7 are extrapolated from it (see docs/RESEARCH.md).
 */
export const DOCKS = [
  { n: 1, bearing: 85, radius: 341, width: 68, canon: true,
    note: 'Flagship yard. Best shipwrights on the island. Foot of the main spine.' },
  { n: 2, bearing: 130, radius: 341, width: 54 },
  { n: 3, bearing: 174, radius: 341, width: 50 },
  { n: 4, bearing: 220, radius: 341, width: 58 },
  { n: 5, bearing: 262.5, radius: 341, width: 46 },
  { n: 6, bearing: 310, radius: 341, width: 56 },
  { n: 7, bearing: 40, radius: 341, width: 48 },
]

export const LANDMARKS = {
  greatFountain: { label: 'The Great Fountain', bearing: 0, radius: 0, tier: 4 },
  galleyLaHQ:    { label: 'Galley-La HQ / Iceburg’s Office', bearing: 97.5, radius: 175, tier: 2 },
  blueStation:   { label: 'Blue Station (Sea Train)', bearing: 17, radius: 388, tier: 0 },
  marketPlaza:   { label: 'Market Plaza', bearing: 97.5, radius: 250, tier: 1 },
  frankyHouse:   { label: 'Franky House', bearing: 52, radius: 458, tier: null },
  scrapIsland:   { label: 'Scrap Island', bearing: 62, radius: 620, tier: null },
}

/** Offshore satellites, which sit outside the main cone's height field. */
export const FRANKY_SPIT = { bearing: 52, radius: 458, size: 46, y: 4 }
export const SCRAP_ISLAND = { bearing: 62, radius: 620, size: 34, y: 3 }

/** Sea Train trestle: leaves Blue Station and runs east over open water. */
export const SEA_TRAIN = {
  startBearing: 17,
  startRadius: 398,
  headingDeg: 12,    // bearing the rails run out along
  length: 900,
  deckY: 7,
}

/** Player spawn: the tier-0 quay just west of Dock 1, facing the harbour. */
/**
 * Player spawn: the tier-0 quay between Dock 1 and the dock canal, at the foot of the
 * ceremonial spine. Close enough to the water that boarding a boat is the obvious first
 * thing to try.
 */
export const SPAWN = { bearing: 92, radius: 359 }

export const AQUA_LAGUNA_SURGE = 6 // metres; drowns tier 0, stops at the tier-1 wall
