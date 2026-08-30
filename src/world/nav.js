/**
 * Navigation surface: the ground, plus bridges on top of it, plus the rules for what
 * the player may stand on. Everything that moves — the player now, the boat later —
 * queries this rather than the raw terrain.
 */

import { heightAt as groundAt, isWaterAt, bearingOf } from './terrain.js'
import { bridgeHeightAt } from './bridges.js'
import { rampHeightAt } from './ramps.js'
import { fountainHeightAt } from './fountainNav.js'

/**
 * The surface a walker stands on at (x, z).
 *
 * The island is not single-storeyed: bridges span canals, ramps carry stair treads, and
 * the fountain has galleries thirty metres over the plaza that people also walk beneath.
 * So this collects every candidate surface and picks one **relative to where the walker
 * already is** — the highest that is not out of reach above them. Without `fromY` it
 * falls back to the topmost structure, which is what a standing-start query wants.
 *
 * This is why you can stand under the fountain's upper balcony instead of being
 * teleported onto it.
 */
export function sampleSurface(x, z, fromY = null) {
  const ground = groundAt(x, z)
  const water = isWaterAt(x, z)

  const candidates = []
  const bridge = bridgeHeightAt(x, z)
  if (bridge !== null) candidates.push({ y: bridge, water: false, onBridge: true })
  const tread = rampHeightAt(x, z)
  if (tread !== null) candidates.push({ y: tread, water: false, onSteps: true })
  const platform = fountainHeightAt(x, z)
  if (platform !== null) candidates.push({ y: platform, water: false, onFountain: true })

  if (!candidates.length) return { y: ground, water, onBridge: false }

  if (fromY === null) {
    // No context: take the topmost structure that is not below the ground.
    let best = { y: ground, water, onBridge: false }
    for (const c of candidates) if (c.y > best.y - 0.5) best = c
    return best
  }

  const reach = fromY + MAX_STEP_UP
  let best = null
  for (const c of [...candidates, { y: ground, water, onBridge: false }]) {
    if (c.y > reach) continue
    if (!best || c.y > best.y) best = c
  }
  // Below everything — the walker is falling, so aim at the ground.
  return best ?? { y: ground, water, onBridge: false }
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
  const s = sampleSurface(to.x, to.z, from.y)
  if (s.water && !allowWater) return null
  const rise = s.y - from.y
  if (rise > MAX_STEP_UP) return null
  if (rise < -MAX_DROP) return null
  return s
}
