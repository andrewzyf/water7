import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  TIERS, RADIAL_CANALS, RING_CANALS, DEG, canalWaterY, ISLAND_RADIUS, SEA_LEVEL,
} from '../world/config.js'
import { ringRadiusAt, canalBearingAt, terraceOuterAt, tierRangeAt } from '../world/shape.js'
import { createWaterMaterial } from '../world/water/WaterMaterial.js'

/**
 * Accumulates strips of water into one buffer, so the whole canal network is a single
 * draw call. Each strip is three vertices wide: bank, centre, bank — the middle column
 * is what gives the shader a `edge = 0` deep line to darken and keeps foam on the quay
 * walls where it belongs.
 */
class StripBuilder {
  constructor() {
    this.pos = []
    this.flow = []
    this.edge = []
    this.idx = []
  }

  /**
   * @param {(t:number) => {c:[number,number], across:[number,number], y:number,
   *                        half:number, flow:[number,number]}} sample
   * @param {number} steps
   */
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

const unit = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG)]
const perp = (deg) => [-Math.sin(deg * DEG), Math.cos(deg * DEG)]

/**
 * Every canal surface on the island.
 *
 * Each terrace holds its water 3.5 m below its own street, so a radial canal is not one
 * sloping ribbon but a staircase of level pools — and the drop between each pair is a
 * waterfall (see Waterfalls). Flow runs outward and downward: the whole network drains
 * from the fountain at the summit to the sea, which is the island's defining feature.
 */
function buildCanals() {
  const b = new StripBuilder()

  for (const tier of TIERS) {
    const y = canalWaterY(tier)

    for (const ch of RADIAL_CANALS.channels) {
      // Use the terrace's real wobbled edges so the pool ends exactly on its own lip.
      const [inner, outer] = tierRangeAt(tier, ch.bearing)
      const r0 = Math.max(inner, ch.inner)
      const r1 = Math.min(outer, ISLAND_RADIUS)
      if (r1 - r0 < 3) continue

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
          across: d,
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
function buildSea() {
  const b = new StripBuilder()
  const OUT = 4200
  const SEG = 360
  const pos = []
  const flow = []
  const edge = []
  const idx = []

  // Radial bands, packed tightly near the shore where the foam and the wave detail are.
  const bands = 34
  const rAt = (j, deg) => {
    const t = j / bands
    const shore = terraceOuterAt(TIERS[TIERS.length - 1], deg) - 10
    return shore + Math.pow(t, 3.1) * (OUT - shore)
  }

  for (let j = 0; j <= bands; j++) {
    for (let i = 0; i <= SEG; i++) {
      const deg = (i / SEG) * 360
      const r = rAt(j, deg)
      const a = deg * DEG
      pos.push(r * Math.cos(a), SEA_LEVEL, r * Math.sin(a))
      // A steady offshore drift; the swell in the vertex shader does the rest.
      flow.push(0.42, 0.26)
      const shore = terraceOuterAt(TIERS[TIERS.length - 1], deg)
      edge.push(1 - THREE.MathUtils.clamp((r - shore) / 46, 0, 1))
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

export default function Water({ sunDirection }) {
  const canalGeo = useMemo(buildCanals, [])
  const seaGeo = useMemo(buildSea, [])

  const canalMat = useMemo(() => createWaterMaterial({
    waveAmp: 0,
    flowSpeed: 0.20,
    rippleScale: 0.075,
    foam: 1.0,
    opacity: 0.9,
    shallow: '#59c2b4',
    deep: '#136066',
  }), [])

  const seaMat = useMemo(() => createWaterMaterial({
    waveAmp: 0.78,
    waveScale: 0.013,
    flowSpeed: 0.05,
    rippleScale: 0.022,
    foam: 1.0,
    opacity: 0.94,
    shallow: '#3ba7bd',
    deep: '#0d3f5e',
  }), [])

  const mats = useRef([canalMat, seaMat])
  useFrame(({ clock }) => {
    for (const m of mats.current) {
      m.uniforms.uTime.value = clock.elapsedTime
      if (sunDirection) m.uniforms.uSunDir.value.copy(sunDirection)
    }
  })

  return (
    <group>
      <mesh geometry={seaGeo} material={seaMat} renderOrder={2} frustumCulled={false} />
      <mesh geometry={canalGeo} material={canalMat} renderOrder={3} frustumCulled={false} />
    </group>
  )
}
