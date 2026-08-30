import { useMemo } from 'react'
import * as THREE from 'three'
import {
  TIERS, RADIAL_CANALS, RING_CANALS, DEG, ISLAND_RADIUS,
} from '../world/config.js'
import { ringRadiusAt, canalBearingAt, tierRangeAt } from '../world/shape.js'
import { ashlarTexture } from '../world/textures.js'

/**
 * Coping stones and mooring posts along every canal bank.
 *
 * The height field gives the canals soft shoulders, because a hard edge in a sampled
 * grid just aliases. A moulded coping laid along both banks restores the crisp line
 * where stone meets water — which is the edge the eye actually reads in the reference
 * art, and the difference between a canal cut into a city and a blue stripe painted on
 * a hill.
 */

/** A box-section ribbon following a sampled centreline, offset to one side. */
function copingRibbon(sample, steps, side, width, height) {
  const pos = []
  const uv = []
  const idx = []
  // Six vertices per station: outer/inner at top, and the two faces dropping away.
  for (let j = 0; j <= steps; j++) {
    const s = sample(j / steps)
    const o = side * (s.half + width * 0.5 + 0.15)
    const cx = s.c[0] + s.across[0] * o
    const cz = s.c[1] + s.across[1] * o
    const ax = s.across[0] * width * 0.5
    const az = s.across[1] * width * 0.5
    const y = s.y
    // top-outer, top-inner, bottom-inner, bottom-outer
    pos.push(cx - ax, y, cz - az)
    pos.push(cx + ax, y, cz + az)
    pos.push(cx + ax, y - height, cz + az)
    pos.push(cx - ax, y - height, cz - az)
    const v = j * 0.5
    uv.push(0, v, 1, v, 1, v, 0, v)
  }
  for (let j = 0; j < steps; j++) {
    const a = j * 4
    const b = a + 4
    idx.push(a, a + 1, b, a + 1, b + 1, b)             // top
    idx.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1) // inner face, over the water
    idx.push(a + 3, a, b + 3, a, b, b + 3)             // outer face
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const unit = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG)]
const perp = (deg) => [-Math.sin(deg * DEG), Math.cos(deg * DEG)]

/** Every canal centreline on the island, as sampleable strips. */
export function canalCentrelines() {
  const lines = []
  for (const tier of TIERS) {
    for (const ch of RADIAL_CANALS.channels) {
      const [inner, outer] = tierRangeAt(tier, ch.bearing)
      const r0 = Math.max(inner, ch.inner)
      const r1 = Math.min(outer, ISLAND_RADIUS)
      if (r1 - r0 < 6) continue
      lines.push({
        steps: 24,
        sample: (t) => {
          const r = r0 + (r1 - r0) * t
          const deg = canalBearingAt(ch, r)
          const d = unit(deg)
          return { c: [r * d[0], r * d[1]], across: perp(deg), y: tier.y, half: ch.halfWidth }
        },
      })
    }
    for (const rc of RING_CANALS) {
      if (rc.tier !== tier.id) continue
      lines.push({
        steps: 300,
        sample: (t) => {
          const deg = t * 360
          const r = ringRadiusAt(rc, deg)
          const d = unit(deg)
          return { c: [r * d[0], r * d[1]], across: d, y: tier.y, half: rc.halfWidth }
        },
      })
    }
  }
  return lines
}

export default function CanalEdges() {
  const lines = useMemo(canalCentrelines, [])

  const geometry = useMemo(() => {
    const geos = []
    for (const line of lines) {
      for (const side of [-1, 1]) {
        geos.push(copingRibbon(line.sample, line.steps, side, 2.2, 3.9))
      }
    }
    // Concatenate into one buffer; these are all position/uv only.
    const pos = []
    const uv = []
    const idx = []
    let off = 0
    for (const g of geos) {
      const p = g.attributes.position
      const t = g.attributes.uv
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i))
        uv.push(t.getX(i), t.getY(i))
      }
      const a = g.index.array
      for (let i = 0; i < a.length; i++) idx.push(a[i] + off)
      off += p.count
    }
    const out = new THREE.BufferGeometry()
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    out.setIndex(idx)
    out.computeVertexNormals()
    out.computeBoundingSphere()
    return out
  }, [lines])

  const stone = useMemo(() => {
    const t = ashlarTexture(512, 4)
    t.repeat.set(1, 1)
    return t
  }, [])

  return (
    <mesh geometry={geometry} castShadow receiveShadow frustumCulled={false}>
      <meshStandardMaterial map={stone} color="#c3bba7" roughness={0.93} />
    </mesh>
  )
}
