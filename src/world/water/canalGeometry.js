/**
 * Geometry for every water surface on the island.
 *
 * Lives in `world/` rather than in the component so that scripts/verify-layout.mjs can
 * assert its face winding. Getting that wrong is invisible in code and nearly invisible
 * on screen — a canal with an inside-out surface is simply back-face culled, so it looks
 * like a drained channel rather than like a bug — and it has happened twice.
 */
import * as THREE from 'three'
import {
  TIERS, RADIAL_CANALS, RING_CANALS, DEG, canalWaterY, ISLAND_RADIUS, SEA_LEVEL,
} from '../config.js'
import { ringRadiusAt, canalBearingAt, terraceOuterAt, tierRangeAt } from '../shape.js'

const unit = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG)]
const perp = (deg) => [-Math.sin(deg * DEG), Math.cos(deg * DEG)]

/**
 * Accumulates strips of water into one buffer, so the whole canal network is a single
 * draw call. Each strip is several vertices wide, giving the shader a smooth `edge`
 * gradient from bank (1) to centre (0) for foam and depth.
 *
 * Winding depends on the handedness of `across` versus the direction of travel: the
 * face normal is cross(across, along), which must come out +Y. A caller whose strip
 * advances the other way round must pass `across` negated. `assertUpward` below is the
 * safety net.
 */
export class StripBuilder {
  constructor() {
    this.pos = []
    this.flow = []
    this.edge = []
    this.idx = []
  }

  strip(sample, steps, across = 5) {
    const base = this.pos.length / 3
    for (let j = 0; j <= steps; j++) {
      const s = sample(j / steps)
      for (let k = 0; k < across; k++) {
        const u = -1 + (2 * k) / (across - 1) // -1 .. 1 across the channel
        this.pos.push(
          s.c[0] + s.across[0] * s.half * u,
          s.y,
          s.c[1] + s.across[1] * s.half * u,
        )
        this.flow.push(s.flow[0], s.flow[1])
        this.edge.push(Math.abs(u))
      }
    }
    for (let j = 0; j < steps; j++) {
      for (let k = 0; k < across - 1; k++) {
        const a = base + j * across + k
        const b = a + across
        this.idx.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('flow', new THREE.Float32BufferAttribute(this.flow, 2))
    g.setAttribute('edge', new THREE.Float32BufferAttribute(this.edge, 1))
    g.setIndex(this.idx)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }
}

/**
 * Every canal surface on the island.
 *
 * Each terrace holds its water 3.5 m below its own street, so a radial canal is not one
 * sloping ribbon but a staircase of level pools — and the drop between each pair is a
 * waterfall (see Waterfalls). Flow runs outward and downward: the whole network drains
 * from the fountain at the summit to the sea.
 */
export function buildCanals() {
  const b = new StripBuilder()

  for (const tier of TIERS) {
    const y = canalWaterY(tier)

    for (const ch of RADIAL_CANALS.channels) {
      // The terrace's real wobbled edges, so each pool ends exactly on its own lip.
      const [inner, outer] = tierRangeAt(tier, ch.bearing)
      const r0 = Math.max(inner, ch.inner)
      const r1 = Math.min(outer, ISLAND_RADIUS)
      if (r1 - r0 < 3) continue

      // Advances radially outward; `across` is tangential. cross(tangential, radial)
      // points up, so this winds correctly as written.
      b.strip((t) => {
        const r = r0 + (r1 - r0) * t
        const deg = canalBearingAt(ch, r)
        const d = unit(deg)
        return {
          c: [r * d[0], r * d[1]],
          across: perp(deg),
          y,
          half: ch.halfWidth,
          flow: d, // outward, i.e. downhill toward the sea
        }
      }, 26)
    }

    // Ring canals ease around the island rather than draining anywhere, so they get a
    // slow tangential drift.
    for (const rc of RING_CANALS) {
      if (rc.tier !== tier.id) continue
      b.strip((t) => {
        const deg = t * 360
        const r = ringRadiusAt(rc, deg)
        const d = unit(deg)
        const p = perp(deg)
        return {
          c: [r * d[0], r * d[1]],
          // Inward, not outward: this strip advances tangentially, so `across` has to
          // point the other way for the face normal to come out +Y.
          across: [-d[0], -d[1]],
          y,
          half: rc.halfWidth,
          flow: [p[0] * 0.32, p[1] * 0.32],
        }
      }, 360)
    }
  }
  return b.build()
}

/** The open sea: a foam ring hugging the shoreline, deep water beyond. */
export function buildSea() {
  const OUT = 4200
  const SEG = 360
  const bands = 34
  const pos = []
  const flow = []
  const edge = []
  const idx = []

  const shoreAt = (deg) => terraceOuterAt(TIERS[TIERS.length - 1], deg)

  for (let j = 0; j <= bands; j++) {
    for (let i = 0; i <= SEG; i++) {
      const deg = (i / SEG) * 360
      const shore = shoreAt(deg)
      // Packed tightly near the shore, where the foam and the wave detail are.
      const r = (shore - 10) + Math.pow(j / bands, 3.1) * (OUT - (shore - 10))
      const a = deg * DEG
      pos.push(r * Math.cos(a), SEA_LEVEL, r * Math.sin(a))
      flow.push(0.42, 0.26)
      // A long falloff: a short one reads as a hard-edged band lying on the sea rather
      // than as water shoaling toward the shore.
      const t = (r - shore) / 150
      edge.push(1 - Math.max(0, Math.min(1, t)))
    }
  }
  const stride = SEG + 1
  for (let j = 0; j < bands; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * stride + i
      idx.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2))
  g.setAttribute('edge', new THREE.Float32BufferAttribute(edge, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** Mean vertex normal Y — positive means the surface faces up, as water must. */
export function meanNormalY(geometry) {
  const n = geometry.attributes.normal
  let sum = 0
  for (let i = 0; i < n.count; i++) sum += n.getY(i)
  return sum / n.count
}
