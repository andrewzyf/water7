import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { GREAT_FOUNTAIN, tierById, RADIAL_CANALS, DEG } from '../../world/config.js'
import { archWallGeometry, columnGeometry, balustradeGeometry, mergeSimple } from '../../world/arch.js'
import { createFallMaterial } from '../../world/water/FallMaterial.js'
import { createWaterMaterial } from '../../world/water/WaterMaterial.js'
import { ashlarTexture } from '../../world/textures.js'

/**
 * The Great Fountain.
 *
 * The island is named for it and shaped around it: every canal on Water 7 drains from
 * this, and the whole stepped-cone silhouette is a plinth for it. The reference art
 * shows a tall pale-blue tiered monument — an arcaded drum, basins spilling into one
 * another, and a slender spire.
 *
 * Built tall rather than wide. A wide base swallows the summit plaza, and the reason to
 * climb the island is to stand at the top and look at this thing.
 */

const STONE = '#dfeaef'
const STONE_MID = '#c3d7e0'
const STONE_DEEP = '#a8c4d1'

/** A basin: a bowl with a moulded lip, holding water. */
function basinGeometry(radius, height, wallT = 1.4) {
  const parts = []
  const outer = new THREE.CylinderGeometry(radius, radius * 0.86, height, 48, 1, true)
  outer.translate(0, height / 2, 0)
  parts.push(outer)
  const floor = new THREE.CylinderGeometry(radius - wallT, radius * 0.86 - wallT, 0.6, 40)
  floor.translate(0, height * 0.44, 0)
  parts.push(floor)
  const inner = new THREE.CylinderGeometry(radius - wallT, radius - wallT, height * 0.6, 40, 1, true)
  inner.translate(0, height * 0.72, 0)
  parts.push(inner)
  const lip = new THREE.TorusGeometry(radius - wallT / 2, wallT * 0.66, 8, 48)
  lip.rotateX(Math.PI / 2)
  lip.translate(0, height, 0)
  parts.push(lip)
  return mergeSimple(parts)
}

/** A cylindrical curtain of water falling from a basin lip to the one below. */
function ringFallGeometry(radius, yTop, yBot, spread = 1.4, segments = 56) {
  const pos = []
  const uv = []
  const fall = []
  const idx = []
  const drop = yTop - yBot
  const STEPS = 8
  for (let j = 0; j <= STEPS; j++) {
    const t = j / STEPS
    const r = radius + spread * t
    const y = yTop - drop * t * t
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2
      pos.push(r * Math.cos(a), y, r * Math.sin(a))
      uv.push((i / segments) * 8, t)
      fall.push(t)
    }
  }
  const stride = segments + 1
  for (let j = 0; j < STEPS; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * stride + i
      idx.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride)
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

/** Flat disc of water sitting in a basin. */
function poolGeometry(radius, y, segments = 44) {
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

export default function GreatFountain() {
  const groundY = tierById(4).y
  const { basinRadius, drumRadius, spireHeight } = GREAT_FOUNTAIN

  // Basin stack: each sits on a drum above the one below.
  const basins = useMemo(() => {
    const specs = [
      { r: basinRadius, h: 4.4, gap: 6.0 },
      { r: basinRadius * 0.70, h: 4.6, gap: 6.4 },
      { r: basinRadius * 0.48, h: 4.4, gap: 6.6 },
      { r: basinRadius * 0.31, h: 4.0, gap: 0 },
    ]
    let y = 11 // the arcaded drum lifts the first basin clear of the plaza
    return specs.map((sp) => {
      const b = { ...sp, y }
      y += sp.h + sp.gap
      return b
    })
  }, [basinRadius])

  const stone = useMemo(() => {
    const t = ashlarTexture(512, 6)
    t.repeat.set(8, 2)
    return t
  }, [])

  const geo = useMemo(() => {
    const basinGeos = basins.map((b) => {
      const g = basinGeometry(b.r, b.h)
      g.translate(0, b.y, 0)
      return g
    })
    const drums = []
    for (let i = 1; i < basins.length; i++) {
      const b = basins[i]
      const below = basins[i - 1]
      const r = b.r * 1.08
      const h = b.y - (below.y + below.h)
      const d = new THREE.CylinderGeometry(r, r * 1.12, h + 0.6, 32)
      d.translate(0, below.y + below.h + h / 2, 0)
      drums.push(d)
      // A moulded collar where each drum meets its basin.
      const collar = new THREE.CylinderGeometry(r * 1.22, r * 1.08, 1.1, 32)
      collar.translate(0, b.y - 0.4, 0)
      drums.push(collar)
    }
    return { basins: mergeSimple(basinGeos), drums: mergeSimple(drums) }
  }, [basins])

  /** Stepped plinth: three broad steps up from the plaza to the arcade. */
  const plinth = useMemo(() => {
    const parts = []
    for (let i = 0; i < 3; i++) {
      const r = drumRadius + 7.5 - i * 2.5
      const step = new THREE.CylinderGeometry(r, r, 0.55, 44)
      step.translate(0, 0.275 + i * 0.5, 0)
      parts.push(step)
    }
    return mergeSimple(parts)
  }, [drumRadius])

  /** The arcaded base — the same vocabulary as the water-gates round the island. */
  const arcade = useMemo(() => {
    const parts = []
    const N = 18
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const panel = archWallGeometry({
        width: (2 * Math.PI * drumRadius) / N + 0.7,
        height: 10.4,
        depth: 3.0,
        openWidth: ((2 * Math.PI * drumRadius) / N) * 0.58,
        openHeight: 7.4,
      })
      panel.rotateY(-a + Math.PI / 2)
      panel.translate(drumRadius * Math.cos(a), 1.5, drumRadius * Math.sin(a))
      parts.push(panel)
    }
    const cap = new THREE.CylinderGeometry(drumRadius + 2.2, drumRadius + 1.2, 1.6, 44)
    cap.translate(0, 12.4, 0)
    parts.push(cap)
    return mergeSimple(parts)
  }, [drumRadius])

  /** A colonnade ringing the lowest basin. */
  const colonnade = useMemo(() => {
    const parts = []
    const N = 14
    const r = basins[0].r * 1.16
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const col = columnGeometry(7.2, 0.66)
      col.translate(r * Math.cos(a), basins[0].y + basins[0].h, r * Math.sin(a))
      parts.push(col)
    }
    const ring = new THREE.CylinderGeometry(r + 1.2, r + 1.2, 1.2, 40)
    ring.translate(0, basins[0].y + basins[0].h + 7.7, 0)
    parts.push(ring)
    return mergeSimple(parts)
  }, [basins])

  /** Balustrade round the plinth's top step. */
  const rail = useMemo(() => {
    const parts = []
    const N = 22
    const r = drumRadius + 7.2
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      // Leave four gaps, aligned with the ramps, so the plinth can be walked onto.
      if (i % 6 === 0) continue
      const seg = balustradeGeometry((2 * Math.PI * r) / N + 0.4, 1.35)
      seg.rotateY(-a + Math.PI / 2)
      seg.translate(r * Math.cos(a), 1.6, r * Math.sin(a))
      parts.push(seg)
    }
    return mergeSimple(parts)
  }, [drumRadius])

  const falls = useMemo(() => {
    const parts = []
    for (let i = basins.length - 1; i > 0; i--) {
      const from = basins[i]
      const to = basins[i - 1]
      parts.push(ringFallGeometry(from.r - 0.7, from.y + from.h, to.y + to.h * 0.7, 1.2))
    }
    // And from the lowest basin down into the plinth pool.
    const b0 = basins[0]
    parts.push(ringFallGeometry(b0.r - 0.7, b0.y + b0.h, 1.9, 2.4))
    return mergeSimple(parts)
  }, [basins])

  /**
   * Eight aqueducts running out to the heads of the eight radial canals. Without these
   * the island's water system starts in mid-air: the fountain is the source, and this
   * is where it visibly leaves.
   */
  const aqueducts = useMemo(() => {
    const parts = []
    for (const ch of RADIAL_CANALS.channels) {
      // Only the four major canals are fed from the summit; the minor ones start far
      // down the slope, and running an aqueduct to those throws a 180 m beam across
      // the whole city.
      if (ch.inner > 70) continue
      const a = ch.bearing * DEG
      const inner = drumRadius + 2
      const outer = ch.inner + 3
      const len = outer - inner
      if (len < 4) continue
      const mid = (inner + outer) / 2
      const w = ch.major ? 5.0 : 3.6
      const trough = new THREE.BoxGeometry(len, 1.5, w)
      trough.rotateY(-a)
      trough.translate(mid * Math.cos(a), 0.75, mid * Math.sin(a))
      parts.push(trough)
      for (const side of [-1, 1]) {
        const wall = new THREE.BoxGeometry(len, 1.1, 0.7)
        wall.rotateY(-a)
        wall.translate(
          mid * Math.cos(a) - Math.sin(a) * side * (w / 2),
          1.6,
          mid * Math.sin(a) + Math.cos(a) * side * (w / 2),
        )
        parts.push(wall)
      }
    }
    return mergeSimple(parts)
  }, [drumRadius])

  const spouts = useMemo(() => RADIAL_CANALS.channels.map((ch) => {
    const a = ch.bearing * DEG
    const r = drumRadius + 0.6
    return {
      key: ch.bearing,
      pos: [r * Math.cos(a), 5.4, r * Math.sin(a)],
      rot: -ch.bearing * DEG,
      major: !!ch.major,
    }
  }), [drumRadius])

  const fallMat = useMemo(() => createFallMaterial({ speed: 1.9 }), [])
  const poolMat = useMemo(() => createWaterMaterial({
    waveAmp: 0, flowSpeed: 0.4, rippleScale: 0.4, foam: 1.0, opacity: 0.9,
    shallow: '#a7e6ec', deep: '#2f8fa5',
  }), [])
  const jetMat = useMemo(() => createFallMaterial({ speed: -2.6, opacity: 0.8 }), [])

  useFrame(({ clock }) => {
    fallMat.uniforms.uTime.value = clock.elapsedTime
    poolMat.uniforms.uTime.value = clock.elapsedTime
    jetMat.uniforms.uTime.value = clock.elapsedTime
  })

  const top = basins[basins.length - 1]
  const spireBase = top.y + top.h

  return (
    <group position={[0, groundY, 0]}>
      <mesh geometry={plinth} receiveShadow castShadow>
        <meshStandardMaterial map={stone} color={STONE_MID} roughness={0.85} />
      </mesh>
      <mesh geometry={rail} castShadow receiveShadow>
        <meshStandardMaterial map={stone} color={STONE} roughness={0.8} />
      </mesh>
      <mesh geometry={aqueducts} castShadow receiveShadow>
        <meshStandardMaterial map={stone} color={STONE_MID} roughness={0.88} />
      </mesh>
      <mesh geometry={arcade} castShadow receiveShadow>
        <meshStandardMaterial map={stone} color={STONE_DEEP} roughness={0.82} />
      </mesh>
      <mesh geometry={geo.drums} castShadow receiveShadow>
        <meshStandardMaterial map={stone} color={STONE_MID} roughness={0.76} />
      </mesh>
      <mesh geometry={geo.basins} castShadow receiveShadow>
        <meshStandardMaterial map={stone} color={STONE} roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh geometry={colonnade} castShadow receiveShadow>
        <meshStandardMaterial map={stone} color={STONE} roughness={0.72} />
      </mesh>

      {/* Water: a pool in every basin, curtains between them. */}
      <mesh geometry={poolGeometry(drumRadius + 6.4, 1.9)} material={poolMat} renderOrder={3} />
      {basins.map((b, i) => (
        <mesh key={i} geometry={poolGeometry(b.r - 1.5, b.y + b.h - 0.45)} material={poolMat} renderOrder={3} />
      ))}
      <mesh geometry={falls} material={fallMat} renderOrder={5} />

      {/* Spouts feeding the eight radial canals. */}
      {spouts.map((s) => (
        <group key={s.key} position={s.pos} rotation={[0, s.rot, 0]}>
          <mesh castShadow>
            <boxGeometry args={[s.major ? 3.4 : 2.6, 2.0, 2.8]} />
            <meshStandardMaterial color={STONE} roughness={0.6} />
          </mesh>
          <mesh position={[1.7, -0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[s.major ? 0.66 : 0.48, s.major ? 0.66 : 0.48, 1.6, 12]} />
            <meshStandardMaterial color="#7f8f96" roughness={0.45} metalness={0.35} />
          </mesh>
        </group>
      ))}

      {/* The spire, rising from the crown basin. */}
      <mesh position={[0, spireBase + spireHeight * 0.5, 0]} castShadow>
        <coneGeometry args={[top.r * 0.86, spireHeight, 32]} />
        <meshStandardMaterial map={stone} color={STONE} roughness={0.55} metalness={0.08} />
      </mesh>
      {/* Collars banding the spire, so it does not read as a plain cone. */}
      {[0.16, 0.38, 0.62].map((f) => (
        <mesh key={f} position={[0, spireBase + spireHeight * f, 0]} castShadow>
          <cylinderGeometry args={[top.r * 0.9 * (1 - f) + 1.4, top.r * 0.95 * (1 - f) + 1.6, 1.4, 32]} />
          <meshStandardMaterial map={stone} color={STONE_MID} roughness={0.6} />
        </mesh>
      ))}
      {/* A jet at the very top: the water's highest point on the island. */}
      <mesh geometry={ringFallGeometry(1.6, spireBase + spireHeight + 12, spireBase + spireHeight + 1, 1.0, 20)}
            material={jetMat} renderOrder={5} />
      <mesh position={[0, spireBase + spireHeight + 2.4, 0]} castShadow>
        <sphereGeometry args={[2.0, 22, 14]} />
        <meshStandardMaterial color="#8fc4d8" roughness={0.25} metalness={0.5} />
      </mesh>
    </group>
  )
}
