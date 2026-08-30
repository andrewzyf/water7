/**
 * Oriented-rectangle overlap, by separating axis.
 *
 * Two buildings whose footprints intersect render as one merged, glitched mass — walls
 * crossing through each other, roofs fused. The block-based placement mostly avoids it,
 * but adjacent rings and the angular jitter can still collide, so placements are tested
 * against their neighbours and overlaps are dropped.
 */

/** World-space corners of an oriented rectangle. */
export function footprint({ x, z, width, depth, rotation }, margin = 0) {
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)
  const hw = width / 2 + margin
  const hd = depth / 2 + margin
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]
    .map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c])
}

/** Do two convex quads overlap? */
export function quadsOverlap(A, B) {
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = poly[i]
      const [x2, z2] = poly[(i + 1) % 4]
      // Outward normal of this edge.
      const ax = -(z2 - z1)
      const az = x2 - x1
      let minA = Infinity
      let maxA = -Infinity
      let minB = Infinity
      let maxB = -Infinity
      for (const [px, pz] of A) {
        const d = px * ax + pz * az
        if (d < minA) minA = d
        if (d > maxA) maxA = d
      }
      for (const [px, pz] of B) {
        const d = px * ax + pz * az
        if (d < minB) minB = d
        if (d > maxB) maxB = d
      }
      if (maxA < minB || maxB < minA) return false
    }
  }
  return true
}

/** A coarse spatial hash, so placement stays linear rather than quadratic. */
export class FootprintIndex {
  constructor(cell = 32) {
    this.cell = cell
    this.buckets = new Map()
  }

  #keys(x, z, reach) {
    const out = []
    const i0 = Math.floor((x - reach) / this.cell)
    const i1 = Math.floor((x + reach) / this.cell)
    const j0 = Math.floor((z - reach) / this.cell)
    const j1 = Math.floor((z + reach) / this.cell)
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) out.push(`${i},${j}`)
    return out
  }

  /** True if `quad` (centred near x,z) hits anything already added. */
  hits(x, z, reach, quad) {
    for (const k of this.#keys(x, z, reach)) {
      const bucket = this.buckets.get(k)
      if (!bucket) continue
      for (const other of bucket) {
        if (quadsOverlap(quad, other)) return true
      }
    }
    return false
  }

  add(x, z, reach, quad) {
    for (const k of this.#keys(x, z, reach)) {
      let bucket = this.buckets.get(k)
      if (!bucket) { bucket = []; this.buckets.set(k, bucket) }
      bucket.push(quad)
    }
  }
}
