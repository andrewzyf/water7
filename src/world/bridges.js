/**
 * Arched stone footbridges.
 *
 * Bridges are defined as part of the height field rather than as decoration, so the
 * same arch that you see is the arch you walk on — collision, the render mesh and the
 * map all read from one definition. Without these the terraces are unwalkable: the
 * canals cut every street.
 */

import { DEG, TIERS, RADIAL_CANALS, RING_CANALS, RAMP_BEARINGS, tierById } from './config.js'
import { angDelta, bearingOf, heightAt as groundAt } from './terrain.js'
import { ringRadiusAt, canalBearingAt, tierRangeAt } from './shape.js'
import { RING_CANALS as RINGS } from './config.js'
import { DOCK_BASIN } from './terrain.js'

export const DECK_HALF_WIDTH = 3.8 // half the walkable width
export const RISE = 1.9            // crown above the line joining the two abutments

/** Signed arc offset, in metres, from `bearing` to `ref` at radius r. */
const arcOffset = (bearing, ref, r) => {
  const d = ((bearing - ref) % 360 + 540) % 360 - 180
  return d * DEG * r
}

function buildBridgeList() {
  const list = []

  // Across the radial canals: two per terrace, at a third and two thirds of its depth,
  // so each block has a crossing without walking to the terrace edge.
  for (const tier of TIERS) {
    if (tier.id === 4) continue
    for (const ch of RADIAL_CANALS.channels) {
      for (const f of [0.18, 0.34, 0.45, 0.52, 0.60, 0.68, 0.86]) {
        const r = tier.inner + (tier.outer - tier.inner) * f
        if (r <= ch.inner) continue
        // A bridge is useless where its own deck would land in other water or inside a
        // dry dock. Skipping those silently used to leave the tier-0 quay ring severed
        // at all eight radial canals, so the lower city could not be walked round.
        if (r > DOCK_BASIN.innerR - 3 && r < DOCK_BASIN.outerR + 1) continue
        const inRing = RINGS.some((rc) => {
          const rr = ringRadiusAt(rc, ch.bearing)
          return Math.abs(r - rr) < rc.halfWidth + 3
        })
        if (inRing) continue
        // Follow the canal's meander, so the bridge actually lands across the water.
        list.push({
          kind: 'radial', bearing: canalBearingAt(ch, r), radius: r,
          y: tier.y, span: ch.halfWidth + 5, tier: tier.id,
        })
      }
    }
  }

  // Across the ring canals: every 30deg, skipping the bearings where a radial canal
  // meets the ring (that junction is open water).
  for (const rc of RING_CANALS) {
    const tier = tierById(rc.tier)
    // Every ramp must carry a bridge over the ring canal it crosses, or the route up
    // from the shore is severed. Those come first; the rest fill in around them.
    const bearings = [...RAMP_BEARINGS]
    for (let b = 15; b < 360; b += 30) bearings.push(b)

    for (const bearing of bearings) {
      if (bearings.indexOf(bearing) >= RAMP_BEARINGS.length
          && RAMP_BEARINGS.some((rb) => angDelta(bearing, rb) < 12)) continue
      const r = ringRadiusAt(rc, bearing)
      // Skip bearings where a radial canal meets the ring — that junction is open water.
      const clash = RADIAL_CANALS.channels.some(
        (ch) => r > ch.inner && angDelta(bearing, canalBearingAt(ch, r)) < 9,
      )
      if (clash) continue
      list.push({ kind: 'ring', bearing, radius: r, y: tier.y, span: rc.halfWidth + 4, tier: rc.tier })
    }
  }
  // Land each deck on the ground that is actually there.
  //
  // A bridge cannot assume its abutments sit at the nominal terrace height: where a
  // bridge crosses a ramp, the street is mid-transition and several metres below it.
  // Sampling both ends and interpolating between them is what keeps every deck flush
  // with the street it meets, which is the difference between a walkable route up the
  // island and a 1 m lip the player cannot step over.
  const landed = []
  for (const br of list) {
    const [a, b] = abutments(br)
    br.yA = a
    br.yB = b
    // A bridge perched on a terrace slope has abutments well below its street, so its
    // deck floats several metres over the ground at one end. Drop those rather than
    // leave a walkway hanging in the air.
    if (Math.abs(a - br.y) > 4 || Math.abs(b - br.y) > 4) continue
    landed.push(br)
  }
  return landed
}

/** Ground height just beyond each end of a bridge deck. */
function abutments(br) {
  const sample = (sign) => {
    const s = sign * (br.span + 2.5)
    let x, z
    if (br.kind === 'radial') {
      // Deck runs tangentially; step around the arc.
      const deg = br.bearing + (s / br.radius) / DEG
      x = br.radius * Math.cos(deg * DEG)
      z = br.radius * Math.sin(deg * DEG)
    } else {
      // Deck runs radially; step in and out.
      const r = br.radius + s
      x = r * Math.cos(br.bearing * DEG)
      z = r * Math.sin(br.bearing * DEG)
    }
    return groundAt(x, z)
  }
  return [sample(-1), sample(1)]
}

export const BRIDGES = buildBridgeList()

/**
 * Deck height at a point, or null if the point is not on a bridge.
 * The deck is a parabolic arch that lands flush with the street at each end.
 */
export function bridgeHeightAt(x, z) {
  const r = Math.hypot(x, z)
  const bearing = bearingOf(x, z)
  let best = null

  for (const br of BRIDGES) {
    if (Math.abs(r - br.radius) > br.span + 2) continue
    let across, along
    if (br.kind === 'radial') {
      across = arcOffset(bearing, br.bearing, r) // along the deck
      along = r - br.radius                      // across the deck
    } else {
      across = r - br.radius
      along = arcOffset(bearing, br.bearing, r)
    }
    if (Math.abs(along) > DECK_HALF_WIDTH) continue
    if (Math.abs(across) > br.span) continue
    const t = across / br.span
    // Base line runs between the two real abutment heights; the arch sits on top.
    const base = br.yA + (br.yB - br.yA) * ((t + 1) / 2)
    const y = base + RISE * (1 - t * t)
    if (best === null || y > best) best = y
  }
  return best
}
