import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { tierById, DEG } from '../../world/config.js'
import { FOUNTAIN, stairSamples } from '../../world/fountainNav.js'
import { archWallGeometry, columnGeometry, balustradeGeometry, mergeSimple } from '../../world/arch.js'
import { createFallMaterial } from '../../world/water/FallMaterial.js'
import { createWaterMaterial } from '../../world/water/WaterMaterial.js'
import { ashlarTexture } from '../../world/textures.js'

/**
 * The Great Fountain.
 *
 * The island is named for it and shaped around it: every canal drains from this, and
 * the whole stepped cone is a plinth for it.
 *
 * Modelled on the reference art: an arcaded stone drum, wide basins each pouring a full
 * glassy curtain over its rim, and — the part that makes it recognisable — a tall
 * ice-blue crystalline plume at the summit rather than a stone spire. The water is the
 * monument; the stonework only holds it up.
 *
 * You can climb it. Two flights and two ring galleries wind up the outside, laid out in
 * disjoint radial bands (see world/fountainNav.js) so the height field never has to hold
 * two floors over one spot.
 */

const STONE = '#eff5f8'
const STONE_MID = '#dbe8ee'
const STONE_DEEP = '#c3d6e0'
const ICE = '#bfe9f5'
const ICE_DEEP = '#7fc9e4'

/** A basin: a bowl with a heavy moulded lip, the thing the curtain pours over. */
function basinGeometry(radius, height, wallT = 1.5) {
  const parts = []
  const outer = new THREE.CylinderGeometry(radius, radius * 0.80, height, 56, 1, true)
  outer.translate(0, height / 2, 0)
  parts.push(outer)
  const floor = new THREE.CylinderGeometry(radius - wallT, radius * 0.80 - wallT, 0.7, 44)
  floor.translate(0, height * 0.46, 0)
  parts.push(floor)
  const inner = new THREE.CylinderGeometry(radius - wallT, radius - wallT, height * 0.58, 44, 1, true)
  inner.translate(0, height * 0.73, 0)
  parts.push(inner)
  const lip = new THREE.TorusGeometry(radius - wallT / 2, wallT * 0.7, 10, 56)
  lip.rotateX(Math.PI / 2)
  lip.translate(0, height, 0)
  parts.push(lip)
  return mergeSimple(parts)
}

/**
 * Every curtain pouring off a basin's rim, in one buffer.
 *
 * Bellied outward as it falls, the way an unbroken sheet of water leaves a lip — that
 * bell shape is the most recognisable thing about this fountain.
 *
 * Built into shared arrays rather than merged afterwards: mergeSimple carries only
 * position, normal and uv, so merging silently drops the per-vertex `fall` the curtain
 * shader fades on — which made every curtain render fully transparent.
 */
function buildCurtains(specs, segments = 72) {
  const pos = []
  const uv = []
  const fall = []
  const idx = []
  const STEPS = 12

  for (const { radius, yTop, yBot, belly } of specs) {
    const base = pos.length / 3
    const drop = yTop - yBot
    for (let j = 0; j <= STEPS; j++) {
      const t = j / STEPS
      // Springs outward at first, then falls nearly vertically.
      const r = radius + belly * Math.sin(t * Math.PI * 0.62)
      const y = yTop - drop * t * t
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2
        pos.push(r * Math.cos(a), y, r * Math.sin(a))
        uv.push((i / segments) * 14, t)
        fall.push(t)
      }
    }
    const stride = segments + 1
    for (let j = 0; j < STEPS; j++) {
      for (let i = 0; i < segments; i++) {
        const a = base + j * stride + i
        idx.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride)
      }
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('fall', new THREE.Float32BufferAttribute(fall, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** The flat apron at the foot of a stair, level with the walk it leaves from. */
function landingApron(stair, band) {
  const [lo, hi] = stair.landing
  const g = new THREE.RingGeometry(band.rIn, band.rOut, 14, 1, lo * DEG, (hi - lo) * DEG)
  g.rotateX(-Math.PI / 2)
  g.scale(1, 1, -1) // RingGeometry sweeps the opposite way round in world XZ
  g.translate(0, stair.yLo, 0)
  return g
}

/** Flat disc of water sitting in a basin. */
function poolGeometry(radius, y, segments = 48) {
  const pos = [0, y, 0]
  const flow = [0, 0]
  const edge = [0]
  const idx = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pos.push(radius * Math.cos(a), y, radius * Math.sin(a))
    flow.push(Math.cos(a) * 0.5, Math.sin(a) * 0.5)
    edge.push(1)
  }
  for (let i = 1; i <= segments; i++) idx.push(0, i, i + 1)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2))
  g.setAttribute('edge', new THREE.Float32BufferAttribute(edge, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/**
 * The plume: a tall jagged column of ice-blue water thrown up from the crown basin.
 * Built from stacked, rotated, tapering spikes so the silhouette is crystalline rather
 * than a smooth cone.
 */
function plumeGeometry(baseRadius, height) {
  const parts = []
  const SHARDS = 26
  for (let i = 0; i < SHARDS; i++) {
    const t = i / (SHARDS - 1)
    // Shards get smaller and lean further out as they climb.
    const h = height * (0.30 - t * 0.20) * (0.7 + ((i * 37) % 10) / 14)
    const r = baseRadius * (1 - t * 0.86) * (0.55 + ((i * 53) % 9) / 12)
    const y = height * t * 0.86
    const lean = t * 0.30 * (((i * 29) % 7) / 3 - 1)
    const spin = (i * 2.399) % (Math.PI * 2)
    const g = new THREE.ConeGeometry(Math.max(r, 0.5), Math.max(h, 3), 5)
    g.rotateZ(lean)
    g.rotateY(spin)
    g.translate(
      Math.cos(spin) * baseRadius * 0.34 * (1 - t),
      y + h / 2,
      Math.sin(spin) * baseRadius * 0.34 * (1 - t),
    )
    parts.push(g)
  }
  // A central spike carrying the peak.
  const core = new THREE.ConeGeometry(baseRadius * 0.42, height, 7)
  core.translate(0, height / 2, 0)
  parts.push(core)
  return mergeSimple(parts)
}

export default function GreatFountain() {
  const groundY = tierById(4).y
  const F = FOUNTAIN

  const stone = useMemo(() => {
    const t = ashlarTexture(512, 6)
    t.repeat.set(10, 2)
    return t
  }, [])

  /** Arcaded drum, and the plaza pool it stands in. */
  const drum = useMemo(() => {
    const parts = []
    const N = 20
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const panel = archWallGeometry({
        width: (2 * Math.PI * F.drumRadius) / N + 0.8,
        height: F.drumTop - 2.2,
        depth: 3.4,
        openWidth: ((2 * Math.PI * F.drumRadius) / N) * 0.56,
        openHeight: (F.drumTop - 2.2) * 0.66,
      })
      panel.rotateY(-a + Math.PI / 2)
      panel.translate(F.drumRadius * Math.cos(a), 1.4, F.drumRadius * Math.sin(a))
      parts.push(panel)
    }
    // The pool basin at plaza level, wide enough to catch the great curtain.
    const rim = F.basins[0].r + 5
    const base = new THREE.CylinderGeometry(rim, rim + 1.2, 2.6, 60)
    base.translate(0, 1.3, 0)
    parts.push(base)
    const well = new THREE.CylinderGeometry(rim - 2.0, rim - 2.0, 2.2, 60, 1, true)
    well.translate(0, 1.5, 0)
    parts.push(well)
    // The cornice carries a broad terrace, so it needs an outer ring of columns under
    // its edge — a 13 m cantilever would read as floating stone.
    const cornice = new THREE.CylinderGeometry(F.gallery1.rOut + 0.8, F.drumRadius + 1.0, 2.4, 52)
    cornice.translate(0, F.drumTop - 1.2, 0)
    parts.push(cornice)

    const N2 = 24
    for (let i = 0; i < N2; i++) {
      const deg = (i / N2) * 360
      // Left open where stair A climbs through.
      if (deg >= F.stairA.bHi - 4 && deg <= F.stairA.bLo + 4) continue
      const a = deg * DEG
      const col = columnGeometry(F.drumTop - 2.4, 0.9)
      col.translate((F.gallery1.rOut - 1.2) * Math.cos(a), 0.9, (F.gallery1.rOut - 1.2) * Math.sin(a))
      parts.push(col)
    }
    return mergeSimple(parts)
  }, [F])

  /** The cornice terrace floor, plus the apron at the foot of stair A. */
  const terrace = useMemo(() => {
    const floor = new THREE.RingGeometry(F.gallery1.rIn, F.gallery1.rOut + 0.8, 56)
    floor.rotateX(-Math.PI / 2)
    floor.translate(0, F.gallery1.y, 0)
    return mergeSimple([floor, landingApron(F.stairA, F.gallery1)])
  }, [F])

  /** Columns carrying the upper balcony, and its floor. */
  const balcony = useMemo(() => {
    const parts = []
    const N = 16
    const rCol = (F.gallery2.rIn + F.gallery2.rOut) / 2
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const col = columnGeometry(F.gallery2.y - F.gallery1.y, 0.85)
      col.translate(rCol * Math.cos(a), F.gallery1.y, rCol * Math.sin(a))
      parts.push(col)
    }
    const deck = new THREE.CylinderGeometry(F.gallery2.rOut, F.gallery2.rOut, 1.4, 56, 1, true)
    deck.translate(0, F.gallery2.y - 0.7, 0)
    parts.push(deck)
    const floor = new THREE.RingGeometry(F.gallery2.rIn, F.gallery2.rOut, 56)
    floor.rotateX(-Math.PI / 2)
    floor.translate(0, F.gallery2.y, 0)
    parts.push(floor)

    parts.push(landingApron(F.stairB, F.gallery2))
    return mergeSimple(parts)
  }, [F])

  /** Both flights of stairs, as treads. */
  const stairs = useMemo(() => {
    const parts = []
    for (const stair of [F.stairA, F.stairB]) {
      const samples = stairSamples(stair, 64)
      for (let i = 0; i < samples.length - 1; i++) {
        const s = samples[i]
        const n = samples[i + 1]
        const arc = Math.abs(n.bearing - s.bearing) * DEG * s.rMid
        const g = new THREE.BoxGeometry(s.width, 1.1, arc + 0.4)
        g.rotateY(-(s.bearing + 90) * DEG)
        const a = s.bearing * DEG
        g.translate(s.rMid * Math.cos(a), n.y - 0.55, s.rMid * Math.sin(a))
        parts.push(g)
      }
    }
    return mergeSimple(parts)
  }, [F])

  /** Balustrades along the galleries and the stairs' outer edges. */
  const rails = useMemo(() => {
    const parts = []
    const ring = (radius, y, skip) => {
      const N = 40
      for (let i = 0; i < N; i++) {
        const deg = (i / N) * 360
        if (skip && deg >= skip[0] && deg <= skip[1]) continue
        const a = deg * DEG
        const seg = balustradeGeometry((2 * Math.PI * radius) / N + 0.4, 1.3)
        seg.rotateY(-a + Math.PI / 2)
        seg.translate(radius * Math.cos(a), y, radius * Math.sin(a))
        parts.push(seg)
      }
    }
    // Gallery 1's outer edge, opened where stair A arrives.
    // A gap wherever a stair or its landing occupies the band, so the rail does not
    // fence off the way up.
    const gap = (st) => {
      const b = [st.bLo, st.bHi, ...(st.landing ?? [])]
      return [Math.min(...b) - 5, Math.max(...b) + 5]
    }
    ring(F.gallery1.rOut, F.gallery1.y, gap(F.stairA))
    ring(F.gallery2.rOut, F.gallery2.y, gap(F.stairB))
    for (const stair of [F.stairA, F.stairB]) {
      for (const s of stairSamples(stair, 26)) {
        const a = s.bearing * DEG
        const r = stair.rOut
        const seg = balustradeGeometry(4.2, 1.3)
        seg.rotateY(-a + Math.PI / 2)
        seg.translate(r * Math.cos(a), s.y, r * Math.sin(a))
        parts.push(seg)
      }
    }
    return parts.length ? mergeSimple(parts) : null
  }, [F])

  /** The flaring corbel that carries the great basin out over the galleries. */
  const skirt = useMemo(() => {
    const sk = F.skirt
    const g = new THREE.CylinderGeometry(sk.rHi, sk.rLo, sk.yHi - sk.yLo, 56, 1, true)
    g.translate(0, (sk.yLo + sk.yHi) / 2, 0)
    return g
  }, [F])

  const columns = useMemo(() => {
    const parts = []
    for (const c of [F.columnA, F.columnB]) {
      const shaft = new THREE.CylinderGeometry(c.r * 0.86, c.r, c.to - c.from, 28)
      shaft.translate(0, (c.from + c.to) / 2, 0)
      parts.push(shaft)
      const collar = new THREE.CylinderGeometry(c.r * 1.5, c.r * 1.1, 1.4, 28)
      collar.translate(0, c.to - 0.6, 0)
      parts.push(collar)
    }
    return mergeSimple(parts)
  }, [F])

  const basinGeo = useMemo(
    () => mergeSimple(F.basins.map((b) => {
      const g = basinGeometry(b.r, b.h)
      g.translate(0, b.base, 0)
      return g
    })),
    [F],
  )

  /** Every curtain: each basin pours onto the one below, the lowest into the plaza pool. */
  const curtains = useMemo(() => buildCurtains(
    F.basins.map((b, i) => {
      const below = F.basins[i - 1]
      return {
        radius: b.r - 0.9,
        yTop: b.base + b.h,
        yBot: below ? below.base + below.h * 0.72 : 2.6,
        belly: i === 0 ? 3.2 : 2.2,
      }
    }),
  ), [F])

  const plume = useMemo(
    () => plumeGeometry(F.basins[2].r * 0.72, F.plumeHeight),
    [F],
  )

  // Translucent: a 34 m curtain at full opacity is a milky wall that hides the whole
  // monument behind it, and the reference sheets are glassy enough to see stone through.
  const fallMat = useMemo(() => createFallMaterial({ speed: 1.5, opacity: 0.5 }), [])
  const poolMat = useMemo(() => createWaterMaterial({
    waveAmp: 0, flowSpeed: 0.4, rippleScale: 0.35, foam: 1.0, opacity: 0.9,
    shallow: '#a9e6ef', deep: '#2f95ad',
  }), [])
  const plumeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: ICE,
    emissive: new THREE.Color(ICE_DEEP),
    emissiveIntensity: 0.32,
    roughness: 0.14,
    metalness: 0.1,
    transparent: true,
    opacity: 0.82,
    flatShading: true,
  }), [])

  useFrame(({ clock }) => {
    fallMat.uniforms.uTime.value = clock.elapsedTime
    poolMat.uniforms.uTime.value = clock.elapsedTime
    // A slow breathing motion, so the plume is alive without being distracting.
    const t = clock.elapsedTime
    plumeMat.emissiveIntensity = 0.28 + Math.sin(t * 0.7) * 0.07
  })

  const stoneMat = (color, rough = 0.76) => (
    <meshStandardMaterial map={stone} color={color} roughness={rough} metalness={0.04} />
  )

  return (
    <group position={[0, groundY, 0]}>
      <mesh geometry={drum} castShadow receiveShadow>{stoneMat(STONE_DEEP, 0.82)}</mesh>
      <mesh geometry={terrace} receiveShadow>
        <meshStandardMaterial map={stone} color={STONE_MID} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={stairs} castShadow receiveShadow>{stoneMat(STONE_MID, 0.9)}</mesh>
      <mesh geometry={balcony} castShadow receiveShadow>
        <meshStandardMaterial map={stone} color={STONE} roughness={0.78} side={THREE.DoubleSide} />
      </mesh>
      {rails && <mesh geometry={rails} castShadow receiveShadow>{stoneMat(STONE)}</mesh>}
      <mesh geometry={skirt} castShadow receiveShadow>
        <meshStandardMaterial map={stone} color={STONE_MID} roughness={0.74} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={columns} castShadow receiveShadow>{stoneMat(STONE)}</mesh>
      <mesh geometry={basinGeo} castShadow receiveShadow>
        <meshStandardMaterial map={stone} color={STONE} roughness={0.68} side={THREE.DoubleSide} />
      </mesh>

      {/* Water. */}
      <mesh geometry={poolGeometry(F.basins[0].r + 4, 2.4)} material={poolMat} renderOrder={3} />
      {F.basins.map((b, i) => (
        <mesh key={i} geometry={poolGeometry(b.r - 1.4, b.base + b.h - 0.4)} material={poolMat} renderOrder={3} />
      ))}
      <mesh geometry={curtains} material={fallMat} renderOrder={5} />

      {/* The plume. */}
      <mesh
        geometry={plume}
        material={plumeMat}
        position={[0, F.plumeBase, 0]}
        castShadow
        renderOrder={4}
      />
    </group>
  )
}
