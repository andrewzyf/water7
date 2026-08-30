/**
 * Navigation surface: the ground, plus bridges on top of it, plus the rules for what
 * the player may stand on. Everything that moves — the player now, the boat later —
 * queries this rather than the raw terrain.
 */

import { heightAt as groundAt, isWaterAt, bearingOf } from './terrain.js'
import { bridgeHeightAt } from './bridges.js'
import { rampHeightAt } from './ramps.js'

/**
 * The surface the player stands on at (x, z): the ground, or whatever built structure
 * sits on top of it — a bridge deck, or a ramp's stair tread.
 */
export function sampleSurface(x, z) {
  const ground = groundAt(x, z)

  const bridge = bridgeHeightAt(x, z)
  if (bridge !== null && bridge >= ground - 0.5) {
    return { y: bridge, water: false, onBridge: true }
  }

  const tread = rampHeightAt(x, z)
  if (tread !== null && tread >= ground - 0.6) {
    return { y: tread, water: false, onBridge: false, onSteps: true }
  }

  return { y: ground, water: isWaterAt(x, z), onBridge: false }
}

/**
 * The most a walker can rise in one **substep** (0.25 m of travel).
 *
 * Sized deliberately between the two things it has to tell apart: a stair riser is
 * 0.42 m, so steps are climbable; the terrace retaining walls are steeper than 72deg at
 * their midpoint, which over 0.25 m is a rise of 0.77 m, so walls are not. The mover
 * must substep at or below MOVE_SUBSTEP for this to hold.
 */
export const MAX_STEP_UP = 0.55
export const MOVE_SUBSTEP = 0.25
export const MAX_DROP = 3.0

/**
 * Can a walker move from `from` to `to`? Rejects open water and anything too steep.
 *
 * The destination is tested where the walker actually lands — probing further ahead
 * than the step being taken puts an invisible wall in front of every slope and edge on
 * the island, which is exactly what it used to do.
 */
export function canStand(from, to, { allowWater = false } = {}) {
  const s = sampleSurface(to.x, to.z)
  if (s.water && !allowWater) return null
  const rise = s.y - from.y
  if (rise > MAX_STEP_UP) return null
  if (rise < -MAX_DROP) return null
  return s
}
