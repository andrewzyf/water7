/**
 * Procedural massing for the residential terraces.
 *
 * Placement is by *block*, not by scattering: each terrace is divided into cells of
 * roughly 24 m, and a building takes the middle of its cell. The leftover margin is
 * what becomes the street grid — concentric terrace streets and radial lanes — which
 * is how the reference art reads: tight blocks separated by narrow walkable slots and
 * canals, not free-standing houses on a field.
 *
 * The returned list is used for three things at once: the instanced render, the
 * player's collision test, and the top-down map.
 */

import {
  TIERS, polar, DEG, RADIAL_CANALS, RING_CANALS, RAMP_BEARINGS, RAMP_HALF_WIDTH,
  LANDMARKS, GREAT_FOUNTAIN,
} from './config.js'
import { canalMask, dockMask, angDelta, heightAt } from './terrain.js'
import { ringRadiusAt, canalBearingAt, terraceOuterAt } from './shape.js'
import { makeRng, rand } from './rng.js'
import { PALETTE } from './palette.js'

/** Keep-out discs around the hand-placed landmarks. */
const EXCLUSIONS = [
  { ...pos(LANDMARKS.greatFountain), r: GREAT_FOUNTAIN.basinRadius + 12 },
  { ...pos(LANDMARKS.galleyLaHQ), r: 46 },
  { ...pos(LANDMARKS.blueStation), r: 40 },
  { ...pos(LANDMARKS.marketPlaza), r: 34 },
]
function pos(l) {
  const [x, z] = polar(l.radius, l.bearing)
  return { x, z }
}

const ROOF_BARREL = 'barrel'
const ROOF_PITCH = 'pitch'
const ROOF_DOME = 'dome'

export function generateCity(seed = 20060601) {
  const rng = makeRng(seed)
  const buildings = []

  for (const tier of TIERS) {
    if (tier.id === 4) continue // the summit is the fountain plaza — kept open

    // Quay margin: leave the terrace's inner and outer edges clear to walk along.
    const inner = tier.inner + 13
    const outer = tier.outer - 13
    if (outer <= inner) continue

    const cellDepth = 16.5
    const rings = Math.max(1, Math.round((outer - inner) / cellDepth))

    for (let ri = 0; ri < rings; ri++) {
      const r0 = inner + ((outer - inner) * ri) / rings
      const r1 = inner + ((outer - inner) * (ri + 1)) / rings
      const rMid = (r0 + r1) * 0.5

      // Angular cells sized to keep block frontage roughly square.
      const cells = Math.max(8, Math.round((2 * Math.PI * rMid) / cellDepth))
      const cellDeg = 360 / cells

      for (let ci = 0; ci < cells; ci++) {
        const bearing = (ci + 0.5) * cellDeg + rand(rng, -cellDeg * 0.12, cellDeg * 0.12)
        const r = rMid + rand(rng, -2.5, 2.5)

        if (!isBuildable(r, bearing, r1 - r0)) continue
        if (rng() < 0.11) continue // gaps: courtyards, squares, missing teeth

        const arcAvail = cellDeg * DEG * r
        const depth = Math.min(r1 - r0, cellDepth) * rand(rng, 0.66, 0.84)
        const width = Math.min(arcAvail, cellDepth) * rand(rng, 0.66, 0.86)

        // Water 7's canal streets are canyons: tall, narrow-fronted houses packed
        // shoulder to shoulder, 3-6 storeys, tallest on the lower terraces where the
        // sinking city stacked itself up highest.
        const storeys = 3 + Math.floor(rng() * (tier.id <= 1 ? 4 : 3))
        const height = storeys * rand(rng, 3.9, 4.7)

        const roll = rng()
        const roof = roll < 0.72 ? ROOF_BARREL : roll < 0.93 ? ROOF_PITCH : ROOF_DOME

        const [x, z] = polar(r, bearing)
        const y = heightAt(x, z)
        // On sloping ground the far corners sit below the centre, so record how deep
        // the foundation has to reach for the building not to float.
        const rot = -(bearing + 90) * DEG
        const cr = Math.cos(rot)
        const sr = Math.sin(rot)
        let lowest = y
        for (const sx of [-0.5, 0.5]) {
          for (const sz of [-0.5, 0.5]) {
            const lx = sx * width
            const lz = sz * depth
            lowest = Math.min(lowest, heightAt(x + lx * cr + lz * sr, z - lx * sr + lz * cr))
          }
        }
        buildings.push({
          x, z, r, bearing,
          y,
          footing: Math.max(1.5, y - lowest + 1.6),
          width, depth, height, roof, storeys,
          tier: tier.id,
          // Local X is the street frontage (tangential), local Z the depth into the
          // block (radial). That puts the barrel vault's banded gable end facing the
          // terrace street, which is how the reference art reads.
          rotation: -(bearing + 90) * DEG,
          wall: PALETTE.plaster[Math.floor(rng() * PALETTE.plaster.length)],
          roofColor: PALETTE.terracotta[Math.floor(rng() * PALETTE.terracotta.length)],
        })
      }
    }
  }
  return buildings
}

/** A cell is buildable only if it clears the canals, docks, ramps and landmarks. */
function isBuildable(r, bearing, cellDepth) {
  // Canals, with a margin so buildings sit back from the water's edge.
  for (const ch of RADIAL_CANALS.channels) {
    if (r <= ch.inner) continue
    const arc = angDelta(bearing, canalBearingAt(ch, r)) * DEG * r
    if (arc < ch.halfWidth + 7) return false
  }
  for (const rc of RING_CANALS) {
    if (Math.abs(r - ringRadiusAt(rc, bearing)) < rc.halfWidth + 7) return false
  }
  // Ramps stay open — they are the only way up.
  for (const b of RAMP_BEARINGS) {
    const arc = angDelta(bearing, b) * DEG * r
    if (arc < 11) return false
  }
  if (canalMask(r, bearing) > 0.02) return false
  if (dockMask(r, bearing) > 0.02) return false

  const [x, z] = polar(r, bearing)
  for (const e of EXCLUSIONS) {
    if (Math.hypot(x - e.x, z - e.z) < e.r) return false
  }
  return true
}

/**
 * Axis-aligned-in-local-space colliders for the player. Each building is an oriented
 * box; we store the rotation so the test can work in the building's own frame.
 */
export function buildColliders(buildings) {
  return buildings.map((b) => ({
    x: b.x, z: b.z,
    hw: b.width / 2 + 0.35,
    hd: b.depth / 2 + 0.35,
    cos: Math.cos(-b.rotation),
    sin: Math.sin(-b.rotation),
    top: b.y + b.height,
  }))
}
