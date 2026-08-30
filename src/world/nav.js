/**
 * Navigation surface: the ground, plus bridges on top of it, plus the rules for what
 * the player may stand on. Everything that moves — the player now, the boat later —
 * queries this rather than the raw terrain.
 */

import { heightAt as groundAt, isWaterAt, bearingOf } from './terrain.js'
import { bridgeHeightAt } from './bridges.js'

/** The surface the player stands on at (x, z). */
export function sampleSurface(x, z) {
  const ground = groundAt(x, z)
  const bridge = bridgeHeightAt(x, z)
  if (bridge !== null && bridge >= ground - 0.5) {
    return { y: bridge, water: false, onBridge: true }
  }
  return { y: ground, water: isWaterAt(x, z), onBridge: false }
}

export const MAX_STEP_UP = 0.62   // over a 0.65 m probe — about 44deg
export const MAX_DROP = 2.4

/**
 * Can the player move from `from` to `to`? Rejects walls, canal edges and open water.
 * Terrace retaining walls fail the slope test; the four ramps pass it. That is the
 * whole of the island's navigation logic.
 */
export function canStand(from, to) {
  const s = sampleSurface(to.x, to.z)
  if (s.water) return null
  const rise = s.y - from.y
  if (rise > MAX_STEP_UP) return null
  if (rise < -MAX_DROP) return null
  return s
}
