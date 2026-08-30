/**
 * The Great Fountain's climbable structure.
 *
 * Shared between the renderer and the navigation surface, so the gallery you can see is
 * the gallery you can stand on — the same arrangement the bridges and ramp treads use.
 *
 * The route up is two flights of stairs and two ring galleries. They are laid out in
 * **disjoint radial bands** so that no two walkable surfaces ever sit at the same (x, z)
 * at different heights, except where a stair shares a band with the gallery it feeds —
 * and there the two occupy different angular sectors. A height field cannot express two
 * floors stacked over one spot, so the geometry is arranged not to need it.
 */
import { DEG, tierById } from './config.js'
import { angDelta, bearingOf } from './terrain.js'

/**
 * Heights here are measured from the fountain's own base, which is the summit plaza.
 * `baseY` lifts them into world space — the navigation surface deals in absolute
 * heights, and mixing the two frames silently puts the stairs 96 m underground.
 */
export const FOUNTAIN = {
  baseY: tierById(4).y,
  drumRadius: 22,
  drumTop: 15,

  /**
   * Cornice terrace on the drum. Stair A shares this band, occupying the one sector the
   * terrace leaves free — 112deg-172deg, chosen because that is where the summit plaza
   * stays flat furthest out (51 m), so the stair's foot lands on real ground instead of
   * hanging over the terrace slope.
   */
  gallery1: { rIn: 22.5, rOut: 27, y: 15 },
  /** Upper balcony, level with the second basin. The high viewpoint. */
  // Butts directly against the terrace: a gap of even a metre between the two bands
  // resolves to bare ground seventeen metres below and severs the route. Kept narrow,
  // and inside the great basin's overhang, so the galleries stay subordinate to the
  // fountain rather than reading as a saucer around it.
  gallery2: { rIn: 27, rOut: 31, y: 27 },

  /** Plaza up to the cornice terrace. */
  /**
   * The landing apron matters as much here as on stair B: without it the only way onto
   * the terrace band from the plaza is the single bearing where the ramp happens to be
   * level with it.
   *
   * Sector 21deg-81deg is chosen because it sits a clear 16deg from the nearest island
   * ramp on either side, and the summit plaza there stays flat out past 50 m — so the
   * apron rests on level ground rather than on a terrace slope.
   */
  stairA: { rIn: 22.5, rOut: 27, yLo: 0, yHi: 15, bLo: 33, bHi: 81, landing: [21, 33] },
  /**
   * Cornice terrace up to the balcony, in the sector the balcony leaves free.
   *
   * `landing` is a flat apron at the stair's foot, held at the terrace's own height.
   * Without it the stair only meets the terrace within about two metres of arc — the
   * one spot where its ramp happens to be level with it — and finding that by walking
   * is unreasonable.
   */
  stairB: { rIn: 27, rOut: 31, yLo: 15, yHi: 27, bLo: 292, bHi: 352, landing: [282, 292] },

  /**
   * The basins overhang everything below them, so the curtains fall clear of the drum
   * and the galleries — which is the shape that makes this fountain recognisable. Both
   * galleries sit *behind* the great curtain.
   */
  basins: [
    { r: 33, base: 31, h: 5.2 },
    { r: 20, base: 45, h: 4.2 },
    { r: 11, base: 57, h: 3.4 },
  ],
  /** Flaring corbel carrying the great basin out over the galleries. */
  skirt: { rLo: 23, yLo: 17, rHi: 33, yHi: 31 },
  columnA: { r: 6.5, from: 36.2, to: 45 },
  columnB: { r: 4.0, from: 49.2, to: 57 },
  plumeBase: 60.4,
  plumeHeight: 80,
}

/** Fraction along a stair's sweep, or null if the bearing is outside it. */
function stairT(stair, bearing) {
  const lo = Math.min(stair.bLo, stair.bHi)
  const hi = Math.max(stair.bLo, stair.bHi)
  if (bearing < lo || bearing > hi) return null
  const t = (bearing - stair.bLo) / (stair.bHi - stair.bLo)
  return t < 0 || t > 1 ? null : t
}

/** Height of the fountain's walkable structure at a point, or null if there is none. */
export function fountainHeightAt(x, z) {
  const r = Math.hypot(x, z)
  const { gallery1, gallery2, stairA, stairB } = FOUNTAIN
  if (r < gallery1.rIn || r > gallery2.rOut) return null
  const bearing = bearingOf(x, z)

  const base = FOUNTAIN.baseY

  // Inner band: the cornice terrace, stair A, or the apron at its foot.
  if (r >= gallery1.rIn && r <= gallery1.rOut) {
    const [aLo, aHi] = stairA.landing
    if (bearing >= aLo && bearing <= aHi) return base + stairA.yLo
    const t = stairT(stairA, bearing)
    if (t !== null) return base + stairA.yLo + (stairA.yHi - stairA.yLo) * t
    return base + gallery1.y
  }

  // Outer band: the balcony, stair B, or the apron at the stair's foot.
  if (r >= gallery2.rIn && r <= gallery2.rOut) {
    const [lo, hi] = stairB.landing
    if (bearing >= lo && bearing <= hi) return base + stairB.yLo
    const t = stairT(stairB, bearing)
    if (t !== null) return base + stairB.yLo + (stairB.yHi - stairB.yLo) * t
    return base + gallery2.y
  }

  return null
}

/** Sampled points along a stair's centreline, for building its treads. */
export function stairSamples(stair, steps = 90) {
  const out = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const bearing = stair.bLo + (stair.bHi - stair.bLo) * t
    out.push({
      bearing,
      y: stair.yLo + (stair.yHi - stair.yLo) * t,
      rMid: (stair.rIn + stair.rOut) / 2,
      width: stair.rOut - stair.rIn,
    })
  }
  return out
}

export { angDelta, DEG }
