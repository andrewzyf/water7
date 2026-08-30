/**
 * Water 7 terrain — an analytic height field.
 *
 * The whole island is one function, height(x, z). That buys us three things from a
 * single definition: the visible mesh, exact collision (no physics engine needed for
 * walking), and a legal-placement test for procedural buildings.
 *
 * Profile, outward from the centre: a stepped cone of five terraces, each edge a steep
 * ashlar retaining wall except at four bearings where it opens into a walkable ramp.
 * Canals are then carved into it — eight radial ones cascading summit-to-sea, plus two
 * ring canals. Canal floors step down per terrace rather than blending, so each terrace
 * edge crossing a radial canal becomes a waterfall.
 */

import {
  DEG, TIERS, ISLAND_RADIUS, SEA_LEVEL, CANAL_DEPTH,
  TERRACE_BLEND, RAMP_BEARINGS, RAMP_HALF_WIDTH, RAMP_BLEND,
  RADIAL_CANALS, RING_CANALS, tierAt, canalWaterY, DOCKS,
} from './config.js'
import { terraceOuterAt, ringRadiusAt, canalBearingAt } from './shape.js'

/** Dry-dock basins: a notch cut into the rim, stopping short of the sea ring. */
export const DOCK_BASIN = { innerR: 326, outerR: 356, floorY: -4.2, sillR: 356 }

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** 1 well inside `edge`, 0 well outside, smooth across a band of `blend`. */
function stepIn(r, edge, blend) {
  const t = clamp01((edge + blend * 0.5 - r) / blend)
  return t * t * (3 - 2 * t)
}

/** Smallest absolute angular difference, degrees. */
export function angDelta(a, b) {
  let d = ((a - b) % 360 + 540) % 360 - 180
  return Math.abs(d)
}

export const bearingOf = (x, z) => (Math.atan2(z, x) / DEG + 360) % 360

/**
 * How wide the terrace edge blend is at this bearing. Narrow everywhere (a wall),
 * widening to a long gentle run at the four ramp bearings.
 */
export function edgeBlendAt(bearing) {
  let best = 0
  for (const b of RAMP_BEARINGS) {
    const d = angDelta(bearing, b)
    if (d < RAMP_HALF_WIDTH) {
      const t = clamp01(1 - d / RAMP_HALF_WIDTH)
      best = Math.max(best, t * t * (3 - 2 * t))
    }
  }
  return TERRACE_BLEND + (RAMP_BLEND - TERRACE_BLEND) * best
}

const TIER0 = TIERS[TIERS.length - 1]

/** The terraced cone, before canals are carved. */
export function terraceHeight(r, bearing) {
  if (r >= ISLAND_RADIUS) {
    // Shoreline shelf, then open seabed.
    const out = r - ISLAND_RADIUS
    if (out < 45) return TIER0.y - (TIER0.y + 13) * clamp01(out / 45)
    return -13
  }
  const blend = edgeBlendAt(bearing)
  let h = TIER0.y
  for (let i = 0; i < TIERS.length - 1; i++) {
    h += (TIERS[i].y - TIERS[i + 1].y) * stepIn(r, terraceOuterAt(TIERS[i], bearing), blend)
  }
  return h
}

/** 0 = dry land, 1 = fully inside a canal channel. */
export function canalMask(r, bearing) {
  if (r >= ISLAND_RADIUS) return 0
  let m = 0
  // Radial canals: convert the angular offset to an arc distance in metres. Each
  // channel starts at its own radius and meanders as it descends.
  for (const ch of RADIAL_CANALS.channels) {
    if (r <= ch.inner) continue
    const arc = angDelta(bearing, canalBearingAt(ch, r)) * DEG * r
    if (arc < ch.halfWidth) m = Math.max(m, 1)
    else if (arc < ch.halfWidth + 3) m = Math.max(m, 1 - (arc - ch.halfWidth) / 3)
  }
  // Ring canals, which bow in and out with the terrace they sit on.
  for (const rc of RING_CANALS) {
    const d = Math.abs(r - ringRadiusAt(rc, bearing))
    if (d < rc.halfWidth) m = Math.max(m, 1)
    else if (d < rc.halfWidth + 3) m = Math.max(m, 1 - (d - rc.halfWidth) / 3)
  }
  return m
}

/** Water surface level for whichever terrace this radius belongs to. */
export function waterLevelAt(r) {
  const t = tierAt(r)
  return t ? canalWaterY(t) : SEA_LEVEL
}

/** Canal bed: stepped per terrace, so terrace crossings become falls. */
function canalFloor(r) {
  return waterLevelAt(r) - 2.6
}

/**
 * 0 = outside every dock, 1 = on a dock basin floor.
 * Dock 1's reference art shows the basin *drained*, with timber stacked on the floor,
 * so these are carved below sea level but deliberately left unflooded.
 */
export function dockMask(r, bearing) {
  if (r < DOCK_BASIN.innerR || r > DOCK_BASIN.outerR) return 0
  let m = 0
  for (const d of DOCKS) {
    const halfDeg = (d.width / 2 / d.radius) / DEG
    const t = 1 - angDelta(bearing, d.bearing) / halfDeg
    if (t > 0) m = Math.max(m, clamp01(t / 0.18)) // 18% of the half-width as a fillet
  }
  // Feather the landward end so the basin has a ramped slipway, not a cliff.
  const back = clamp01((r - DOCK_BASIN.innerR) / 16)
  return m * (back * back * (3 - 2 * back))
}

/** Which dock (if any) contains this point. */
export function dockAt(x, z) {
  const r = Math.hypot(x, z)
  if (r < DOCK_BASIN.innerR || r > DOCK_BASIN.outerR) return null
  const bearing = bearingOf(x, z)
  for (const d of DOCKS) {
    const halfDeg = (d.width / 2 / d.radius) / DEG
    if (angDelta(bearing, d.bearing) < halfDeg) return d
  }
  return null
}

/**
 * Ground height, ignoring bridges. `heightAt` in nav.js layers bridges on top; the
 * raw form is what the island mesh is built from.
 */
export function heightAt(x, z) {
  const r = Math.hypot(x, z)
  const bearing = bearingOf(x, z)
  const land = terraceHeight(r, bearing)

  const dm = dockMask(r, bearing)
  const base = dm > 0 ? land + (DOCK_BASIN.floorY - land) * dm : land

  const m = canalMask(r, bearing)
  if (m <= 0) return base
  return base + (canalFloor(r) - base) * m * (1 - dm)
}

/** True where the point is open water the player should not be standing on. */
export function isWaterAt(x, z) {
  const r = Math.hypot(x, z)
  if (r >= ISLAND_RADIUS) return true
  const bearing = bearingOf(x, z)
  if (dockMask(r, bearing) > 0.3) return false // drained dry dock — walkable
  return canalMask(r, bearing) > 0.5
}

/**
 * Build the island mesh as a polar grid. Polar beats a cartesian grid here: the
 * terraces, ring canals and radial canals are all aligned to it, so edges stay crisp
 * without needing a huge vertex count.
 */
export function buildIslandGeometry(THREE, {
  radialSegments = 720,
  ringSegments = 300,
  maxRadius = ISLAND_RADIUS + 46,
} = {}) {
  const positions = []
  const normals = []
  const indices = []

  // Denser sampling near the rim where the docks and canals live.
  const radiusAt = (j) => {
    const t = j / ringSegments
    return Math.pow(t, 0.82) * maxRadius
  }

  for (let j = 0; j <= ringSegments; j++) {
    const r = radiusAt(j)
    for (let i = 0; i <= radialSegments; i++) {
      const deg = (i / radialSegments) * 360
      const a = deg * DEG
      const x = r * Math.cos(a)
      const z = r * Math.sin(a)
      positions.push(x, heightAt(x, z), z)
      normals.push(0, 1, 0)
    }
  }

  const stride = radialSegments + 1
  for (let j = 0; j < ringSegments; j++) {
    for (let i = 0; i < radialSegments; i++) {
      const a = j * stride + i
      const b = a + 1
      const c = a + stride
      const d = c + 1
      // Wound so the surface normal points up (+Y) after computeVertexNormals.
      indices.push(a, b, c, b, d, c)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}
