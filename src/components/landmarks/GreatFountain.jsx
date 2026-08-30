import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { GREAT_FOUNTAIN, tierById, RADIAL_CANALS, DEG } from '../../world/config.js'
import { PALETTE } from '../../world/palette.js'
import { archWallGeometry, columnGeometry, balustradeGeometry, mergeSimple } from '../../world/arch.js'
import { createFallMaterial } from '../../world/water/FallMaterial.js'
import { createWaterMaterial } from '../../world/water/WaterMaterial.js'
import { ashlarTexture } from '../../world/textures.js'

/**
 * The Great Fountain.
 *
 * This is the thing the whole island is named for and shaped around: the source that
 * every canal drains from, standing on the summit. The reference art shows a tall
 * pale-blue tiered structure — an arcaded drum, stacked basins spilling into one
 * another, and a slender spire.
 *
 * Built as four stacked basins with real water in each, ring curtains falling between
 * them, and eight spouts on the lowest basin aimed down the eight radial canals — so
 * the island's water system visibly begins here.
 */

const STONE = '#dbe7ec'
const STONE_DEEP = '#b9d0da'

/** A basin: a bowl with a moulded lip, holding water. */
function basinGeometry(radius, height, wallT = 1.6) {
  const parts = []
  const outer = new THREE.CylinderGeometry(radius, radius * 0.9, height, 48, 1, true)
  outer.translate(0, height / 2, 0)
  parts.push(outer)
  const floor = new THREE.CylinderGeometry(radius - wallT, radius * 0.9 - wallT, 0.6, 40)
  floor.translate(0, height * 0.42, 0)
  parts.push(floor)
  const inner = new THREE.CylinderGeometry(radius - wallT, radius - wallT, height * 0.6, 40, 1, true)
  inner.translate(0, height * 0.72, 0)
  parts.push(inner)
  // Moulded lip, which is what the water pours over.
  const lip = new THREE.TorusGeometry(radius - wallT / 2, wallT * 0.62, 8, 48)
  lip.rotateX(Math.PI / 2)
  lip.translate(0, height, 0)
  parts.push(lip)
  return mergeSimple(parts)
}

/** A cylindrical curtain of water falling from a basin lip to the one below. */
function ringFallGeometry(radius, yTop, yBot, spread = 1.6, segments = 64) {
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
      uv.push(i / segments * 8, t)
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
function poolGeometry(radius, y, segments = 48) {
  const pos = []
  const flow = []
  const edge = []
  const idx = []
  pos.push(0, y, 0); flow.push(0, 0); edge.push(0)
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
  const { basinRadius, spireHeight } = GREAT_FOUNTAIN

  // Basin stack: radius, height of its wall, and the y it sits at.
  const basins = useMemo(() => {
    const out = []
    let y = 0
    const specs = [
      { r: basinRadius, h: 5.0 },
      { r: basinRadius * 0.70, h: 5.6 },
      { r: basinRadius * 0.46, h: 5.8 },
      { r: basinRadius * 0.28, h: 5.4 },
    ]
    for (const sp of specs) {
      out.push({ ...sp, y })
      y += sp.h + 3.4 // drum between this basin and the next
    }
    return out
  }, [basinRadius])

  const stone = useMemo(() => {
    const t = ashlarTexture(512, 6)
    t.repeat.set(6, 2)
    return t
  }, [])

  const geo = useMemo(() => {
    const basinGeos = basins.map((b) => {
      const g = basinGeometry(b.r, b.h)
      g.translate(0, b.y, 0)
      return g
    })

    // Drums carrying each basin, arcaded on the widest one.
    const drums = []
    for (let i = 1; i < basins.length; i++) {
      const b = basins[i]
      const below = basins[i - 1]
      const r = b.r * 1.06
      const h = b.y - (below.y + below.h)
      const d = new THREE.CylinderGeometry(r, r * 1.1, h + 0.6, 36)
      d.translate(0, below.y + below.h + h / 2, 0)
      drums.push(d)
    }
    return { basins: mergeSimple(basinGeos), drums: mergeSimple(drums) }
  }, [basins])

  // The arcaded base: a ring of arched openings, the same vocabulary as the island's
  // water-gates further down.
  const arcade = useMemo(() => {
    const parts = []
    const N = 16
    const r = basinRadius * 1.16
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const panel = archWallGeometry({
        width: (2 * Math.PI * r) / N + 0.6,
        height: 7.5,
        depth: 2.4,
        openWidth: (2 * Math.PI * r) / N * 0.6,
        openHeight: 5.6,
      })
      panel.rotateY(-a + Math.PI / 2)
      panel.translate(r * Math.cos(a), -7.5, r * Math.sin(a))
      parts.push(panel)
    }
    return mergeSimple(parts)
  }, [basinRadius])

  const colonnade = useMemo(() => {
    const parts = []
    const N = 12
    const r = basins[1].r * 1.34
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const col = columnGeometry(6.4, 0.72)
      col.translate(r * Math.cos(a), basins[0].y + basins[0].h, r * Math.sin(a))
      parts.push(col)
    }
    const ringTop = new THREE.CylinderGeometry(r + 1.1, r + 1.1, 1.1, 36)
    ringTop.translate(0, basins[0].y + basins[0].h + 6.9, 0)
    parts.push(ringTop)
    return mergeSimple(parts)
  }, [basins])

  const rail = useMemo(() => {
    const parts = []
    const N = 24
    const r = basinRadius * 1.2
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const seg = balustradeGeometry((2 * Math.PI * r) / N + 0.3, 1.5)
      seg.rotateY(-a + Math.PI / 2)
      seg.translate(r * Math.cos(a), 0, r * Math.sin(a))
      parts.push(seg)
    }
    return mergeSimple(parts)
  }, [basinRadius])

  const falls = useMemo(() => {
    const parts = []
    for (let i = basins.length - 1; i > 0; i--) {
      const from = basins[i]
      const to = basins[i - 1]
      parts.push(ringFallGeometry(from.r - 0.8, from.y + from.h, to.y + to.h * 0.72, 1.4))
    }
    return mergeSimple(parts)
  }, [basins])

  /** Eight spouts on the lowest basin, one per radial canal — the water's departure. */
  const spouts = useMemo(() => RADIAL_CANALS.channels.map((ch) => {
    const a = ch.bearing * DEG
    const r = basinRadius * 1.02
    return {
      key: ch.bearing,
      pos: [r * Math.cos(a), basins[0].y + basins[0].h * 0.66, r * Math.sin(a)],
      rot: -ch.bearing * DEG,
      major: !!ch.major,
    }
  }), [basins, basinRadius])

  const fallMat = useMemo(() => createFallMaterial({ speed: 1.9 }), [])
  const poolMat = useMemo(() => createWaterMaterial({
    waveAmp: 0, flowSpeed: 0.4, rippleScale: 0.4, foam: 1.0, opacity: 0.88,
    shallow: '#9adfe4', deep: '#2f8fa5',
  }), [])

  useFrame(({ clock }) => {
    fallMat.uniforms.uTime.value = clock.elapsedTime
    poolMat.uniforms.uTime.value = clock.elapsedTime
  })

  const stoneMat = (color, rough = 0.72) => (
    <meshStandardMaterial map={stone} color={color} roughness={rough} metalness={0.04} />
  )

  return (
    <group position={[0, groundY, 0]}>
      <mesh geometry={arcade} castShadow receiveShadow>{stoneMat(STONE_DEEP, 0.8)}</mesh>
      <mesh geometry={geo.drums} castShadow receiveShadow>{stoneMat(STONE_DEEP)}</mesh>
      <mesh geometry={geo.basins} castShadow receiveShadow>{stoneMat(STONE)}</mesh>
      <mesh geometry={colonnade} castShadow receiveShadow>{stoneMat(STONE)}</mesh>
      <mesh geometry={rail} castShadow receiveShadow>{stoneMat(STONE)}</mesh>

      {/* Water held in each basin. */}
      {basins.map((b, i) => (
        <mesh
          key={i}
          geometry={poolGeometry(b.r - 1.7, b.y + b.h - 0.5)}
          material={poolMat}
          renderOrder={3}
        />
      ))}

      {/* Curtains between the basins. */}
      <mesh geometry={falls} material={fallMat} renderOrder={5} />

      {/* Spouts feeding the eight radial canals. */}
      {spouts.map((s) => (
        <group key={s.key} position={s.pos} rotation={[0, s.rot, 0]}>
          <mesh castShadow>
            <boxGeometry args={[s.major ? 3.0 : 2.2, 1.5, 2.4]} />
            <meshStandardMaterial color={STONE} roughness={0.6} />
          </mesh>
          <mesh position={[1.5, -0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[s.major ? 0.62 : 0.44, s.major ? 0.62 : 0.44, 1.4, 12]} />
            <meshStandardMaterial color="#7f8f96" roughness={0.5} metalness={0.3} />
          </mesh>
        </group>
      ))}

      {/* The spire. */}
      <mesh position={[0, basins[3].y + basins[3].h + spireHeight * 0.5, 0]} castShadow>
        <coneGeometry args={[basinRadius * 0.2, spireHeight, 28]} />
        <meshStandardMaterial color={STONE} roughness={0.55} metalness={0.06} />
      </mesh>
      <mesh position={[0, basins[3].y + basins[3].h + spireHeight * 0.5, 0]} castShadow>
        <cylinderGeometry args={[basinRadius * 0.215, basinRadius * 0.215, 1.5, 28]} />
        <meshStandardMaterial color={STONE_DEEP} roughness={0.5} />
      </mesh>
      <mesh position={[0, basins[3].y + basins[3].h + spireHeight + 2.6, 0]} castShadow>
        <sphereGeometry args={[2.2, 20, 14]} />
        <meshStandardMaterial color="#8fc4d8" roughness={0.25} metalness={0.45} />
      </mesh>
    </group>
  )
}
