/**
 * Everything solid the player can bump into.
 *
 * The city's procedural buildings were the only things with collision, so you could
 * walk straight through Galley-La HQ, the dock gates, the station and the fountain —
 * the landmarks are hand-placed meshes that no generator knew about. This assembles one
 * list from all of them so the walker has a single thing to test against.
 *
 * Colliders are oriented boxes (a yaw plus half-extents) or circles. Both are cheap to
 * test and neither needs a physics engine.
 */
import {
  DOCKS, LANDMARKS, FRANKY_SPIT, SCRAP_ISLAND,
  polar, outwardYaw, tierById,
} from './config.js'
import { FOUNTAIN } from './fountainNav.js'
import { DOCK_BASIN } from './terrain.js'

/** An oriented box, in the same form the city generator emits. */
function box(x, z, width, depth, yaw, top) {
  return {
    x, z,
    hw: width / 2,
    hd: depth / 2,
    cos: Math.cos(-yaw),
    sin: Math.sin(-yaw),
    top,
  }
}

/** A circle, for towers, drums and islets. */
function circle(x, z, radius, top) {
  return { x, z, circle: true, r: radius, top }
}

/** Place something in a landmark's local frame: local X tangential, local Z outward. */
function local(bearing, radius, lx, lz) {
  const yaw = outwardYaw(bearing)
  const [ox, oz] = polar(radius, bearing)
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return [ox + lx * c + lz * s, oz - lx * s + lz * c]
}

export function landmarkColliders() {
  const out = []

  // --- Great Fountain: the drum only. The galleries wrapping it are walkable, and the
  // plaza runs right up to its steps. ---
  out.push(circle(0, 0, FOUNTAIN.drumRadius - 0.5, tierById(4).y + 80))

  // --- Galley-La HQ ---
  {
    const l = LANDMARKS.galleyLaHQ
    const yaw = outwardYaw(l.bearing)
    const y = tierById(2).y
    const hall = local(l.bearing, l.radius, 0, 12)
    out.push(box(hall[0], hall[1], 62, 22, yaw, y + 30))
    const block = local(l.bearing, l.radius, 0, -16)
    out.push(box(block[0], block[1], 42, 30, yaw, y + 40))
    for (const [lx, lz] of [[-24, -34], [24, -34], [-24, -2], [24, -2]]) {
      const p = local(l.bearing, l.radius, lx, lz)
      out.push(circle(p[0], p[1], 5.4, y + 50))
    }
  }

  // --- Blue Station: concourse and clock tower (the platform is walkable) ---
  {
    const l = LANDMARKS.blueStation
    const yaw = outwardYaw(l.bearing)
    const y = tierById(0).y
    const hall = local(l.bearing, l.radius, 0, -2)
    out.push(box(hall[0], hall[1], 54, 24, yaw, y + 24))
    const tower = local(l.bearing, l.radius, 24, 6)
    out.push(circle(tower[0], tower[1], 5.4, y + 50))
  }

  // --- Dock gates and their flanking sheds ---
  for (const d of DOCKS) {
    const yaw = outwardYaw(d.bearing)
    const y = tierById(0).y
    const [gx, gz] = polar(DOCK_BASIN.innerR - 5, d.bearing)
    // Only the piers either side of the arch are solid; the opening is walk-through.
    const halfOpen = d.width * 0.31
    const pierW = (d.width + 9) / 2 - halfOpen
    for (const side of [-1, 1]) {
      const cx = side * (halfOpen + pierW / 2)
      const c = Math.cos(yaw)
      const s = Math.sin(yaw)
      out.push(box(gx + cx * c, gz - cx * s, pierW, 4.5, yaw, y + 30))
    }
  }

  // --- Outskirts ---
  {
    const f = FRANKY_SPIT
    const [fx, fz] = polar(f.radius, f.bearing)
    out.push(box(fx, fz, 38, 28, outwardYaw(f.bearing), f.y + 24))
    const [sx, sz] = polar(SCRAP_ISLAND.radius, SCRAP_ISLAND.bearing)
    out.push(circle(sx, sz, SCRAP_ISLAND.size * 0.8, SCRAP_ISLAND.y + 16))
  }

  return out
}

/** Market stall counters — waist-height and worth walking round. */
export function propColliders(props) {
  return (props?.stallTops ?? []).map((s) =>
    box(s.position[0], s.position[2], s.scale[0] * 0.8, s.scale[2] * 0.8, s.rotation, s.position[1]))
}

/**
 * Does a disc of radius `rad` centred on (x, z) overlap anything solid?
 * Testing a disc rather than a point is what stops the player's shoulders from sinking
 * into a wall when they slide along it.
 */
export function blocked(x, z, colliders, rad = 0.45) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i]
    const dx = x - c.x
    const dz = z - c.z
    if (c.circle) {
      const rr = c.r + rad
      if (dx * dx + dz * dz < rr * rr) return true
      continue
    }
    if (Math.abs(dx) > 60 || Math.abs(dz) > 60) continue
    const lx = dx * c.cos - dz * c.sin
    const lz = dx * c.sin + dz * c.cos
    if (Math.abs(lx) < c.hw + rad && Math.abs(lz) < c.hd + rad) return true
  }
  return false
}
