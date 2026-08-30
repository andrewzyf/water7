/**
 * The four ramps, as stepped streets.
 *
 * The steps are generated here rather than in the renderer so that the geometry you see
 * and the surface you stand on come from one definition — the same rule the bridges
 * follow. When the treads were decoration only, the player walked the smooth slope
 * underneath and visibly sank through every step.
 *
 * Treads are level, and each one's top sits at the terrain height of its uphill edge,
 * so a tread meets the ground flush at the back and stands a riser proud at the front.
 * That is what a real stair does.
 */
import { RAMP_BEARINGS, RAMP_HALF_WIDTH, DEG, ISLAND_RADIUS } from './config.js'
import { heightAt, angDelta, bearingOf, isWaterAt } from './terrain.js'

export const RISER = 0.38
/** Treads span most of the ramp corridor, leaving smooth verges either side. */
export const STEP_HALF_DEG = RAMP_HALF_WIDTH * 0.72

function buildRamps() {
  return RAMP_BEARINGS.map((bearing) => {
    const a = bearing * DEG
    const cos = Math.cos(a)
    const sin = Math.sin(a)

    // Walk uphill (r decreasing), cutting a tread each time the ground has risen a full
    // riser. Ramps cross both ring canals on the way up; those spans are skipped, since
    // the ground there is the canal bed and a bridge already carries the route over.
    const steps = []
    let lastR = null
    let lastY = 0

    // Sampled finely: a coarse walk overshoots the riser threshold by however much the
    // ground climbed since the last sample, giving uneven steps — and one tall enough to
    // exceed the walker's step-up limit turns the stair into a wall.
    for (let r = ISLAND_RADIUS - 12; r > 30; r -= 0.08) {
      const x = r * cos
      const z = r * sin
      if (isWaterAt(x, z)) {
        lastR = null // close the run; the next dry stretch starts a fresh flight
        continue
      }
      const y = heightAt(x, z)
      if (lastR === null) { lastR = r; lastY = y; continue }
      // Only cut a tread where the ground genuinely rises: a dip means the profile is
      // still settling out of a crossing, and a tread there would sit below the ground.
      if (y - lastY < RISER) continue
      steps.push({ rLo: r, rHi: lastR, y })
      lastR = r
      lastY = y
    }
    // Sorted by rLo ascending, so a radius can be found by scan or bisect.
    steps.sort((p, q) => p.rLo - q.rLo)
    return { bearing, steps }
  })
}

export const RAMPS = buildRamps()

/** Tread height at a world position, or null if not on a ramp step. */
export function rampHeightAt(x, z) {
  const r = Math.hypot(x, z)
  if (r > ISLAND_RADIUS || r < 28) return null
  const bearing = bearingOf(x, z)

  for (const ramp of RAMPS) {
    if (angDelta(bearing, ramp.bearing) > STEP_HALF_DEG) continue
    const steps = ramp.steps
    // Bisect on rLo.
    let lo = 0
    let hi = steps.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const s = steps[mid]
      if (r < s.rLo) hi = mid - 1
      else if (r > s.rHi) lo = mid + 1
      else return s.y
    }
  }
  return null
}

/** Every tread, for the renderer. */
export function allSteps() {
  const out = []
  for (const ramp of RAMPS) {
    for (const s of ramp.steps) {
      const rMid = (s.rLo + s.rHi) / 2
      out.push({
        bearing: ramp.bearing,
        rMid,
        width: STEP_HALF_DEG * 2 * DEG * rMid,
        depth: s.rHi - s.rLo,
        y: s.y,
      })
    }
  }
  return out
}
