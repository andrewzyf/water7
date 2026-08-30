/**
 * Architectural geometry helpers.
 *
 * Water 7 is an arcaded city — arched water-gates around its base, arched footbridges,
 * loggias on the civic buildings. A box with a dark rectangle painted on it does not
 * read as an arch, so these build real openings: a wall panel is extruded from a shape
 * with an arch-topped hole punched through it, and you can see daylight on the far side.
 */
import * as THREE from 'three'

/** A rectangle with a round-headed opening cut through it. */
export function archWallGeometry({
  width, height, depth,
  openWidth, openHeight,
  count = 1,
  gap = 0,
}) {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  shape.lineTo(width / 2, 0)
  shape.lineTo(width / 2, height)
  shape.lineTo(-width / 2, height)
  shape.closePath()

  const pitch = openWidth + gap
  const total = count * pitch - gap
  for (let i = 0; i < count; i++) {
    const cx = -total / 2 + pitch * i + openWidth / 2
    const r = openWidth / 2
    const springing = Math.max(0.1, openHeight - r)
    const hole = new THREE.Path()
    hole.moveTo(cx - r, 0)
    hole.lineTo(cx - r, springing)
    hole.absarc(cx, springing, r, Math.PI, 0, true)
    hole.lineTo(cx + r, 0)
    hole.closePath()
    shape.holes.push(hole)
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 18 })
  geo.translate(0, 0, -depth / 2)
  geo.computeVertexNormals()
  return geo
}

/** A classical-ish column: moulded base, slightly tapered shaft, spreading capital. */
export function columnGeometry(height, radius, segments = 16) {
  const parts = []
  const base = new THREE.CylinderGeometry(radius * 1.28, radius * 1.42, height * 0.07, segments)
  base.translate(0, height * 0.035, 0)
  parts.push(base)

  const shaft = new THREE.CylinderGeometry(radius * 0.86, radius, height * 0.84, segments)
  shaft.translate(0, height * 0.07 + height * 0.42, 0)
  parts.push(shaft)

  const cap = new THREE.CylinderGeometry(radius * 1.4, radius * 0.9, height * 0.09, segments)
  cap.translate(0, height * 0.955, 0)
  parts.push(cap)

  return mergeSimple(parts)
}

/** A run of balusters under a moulded rail, along local X. */
export function balustradeGeometry(length, height = 1.15, spacing = 0.9) {
  const parts = []
  const rail = new THREE.BoxGeometry(length, height * 0.16, height * 0.34)
  rail.translate(0, height * 0.92, 0)
  parts.push(rail)
  const foot = new THREE.BoxGeometry(length, height * 0.13, height * 0.34)
  foot.translate(0, height * 0.065, 0)
  parts.push(foot)

  const n = Math.max(2, Math.round(length / spacing))
  for (let i = 0; i < n; i++) {
    const x = -length / 2 + (length / n) * (i + 0.5)
    const b = new THREE.CylinderGeometry(height * 0.09, height * 0.13, height * 0.72, 8)
    b.translate(x, height * 0.48, 0)
    parts.push(b)
  }
  return mergeSimple(parts)
}

/** A flight of steps running along local Z, rising along local Y. */
export function stairGeometry(width, rise, run, steps) {
  const parts = []
  const tread = run / steps
  const riser = rise / steps
  for (let i = 0; i < steps; i++) {
    const g = new THREE.BoxGeometry(width, riser * (i + 1), tread)
    g.translate(0, (riser * (i + 1)) / 2, -run / 2 + tread * (i + 0.5))
    parts.push(g)
  }
  return mergeSimple(parts)
}

/** Concatenate geometries that all share position/normal/uv attributes. */
export function mergeSimple(geos) {
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  let offset = 0
  for (const g of geos) {
    const p = g.attributes.position
    const n = g.attributes.normal
    const t = g.attributes.uv
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i))
      nor.push(n.getX(i), n.getY(i), n.getZ(i))
      uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0)
    }
    if (g.index) {
      const a = g.index.array
      for (let i = 0; i < a.length; i++) idx.push(a[i] + offset)
    } else {
      for (let i = 0; i < p.count; i++) idx.push(i + offset)
    }
    offset += p.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  out.setIndex(idx)
  out.computeBoundingSphere()
  return out
}
