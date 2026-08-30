import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  TIERS, RADIAL_CANALS, RING_CANALS, DEG, canalWaterY, ISLAND_RADIUS,
} from '../world/config.js'
import { annularSector } from '../world/geom.js'
import { ringRadiusAt, canalBearingAt } from '../world/shape.js'
import { PALETTE } from '../world/palette.js'

/**
 * A constant-width channel following a canal's meander from r0 to r1.
 * The centreline bearing is re-evaluated at every step, so the water sits exactly
 * over the channel carved into the terrain.
 */
function radialChannel(channel, r0, r1, y, steps = 30) {
  const positions = []
  const indices = []
  for (let j = 0; j <= steps; j++) {
    const r = r0 + ((r1 - r0) * j) / steps
    const a = canalBearingAt(channel, r) * DEG
    const dir = [Math.cos(a), Math.sin(a)]
    const tan = [-Math.sin(a), Math.cos(a)]
    for (let s = -1; s <= 1; s += 2) {
      positions.push(
        r * dir[0] + s * channel.halfWidth * tan[0],
        y,
        r * dir[1] + s * channel.halfWidth * tan[1],
      )
    }
  }
  for (let j = 0; j < steps; j++) {
    const a0 = j * 2
    // Wound CCW seen from above.
    indices.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** A ring canal's surface, bowing in and out with the terrace it sits on. */
function ringBand(rc, y, segments = 360) {
  const positions = []
  const indices = []
  for (let i = 0; i <= segments; i++) {
    const deg = (i / segments) * 360
    const a = deg * DEG
    const rc0 = ringRadiusAt(rc, deg)
    for (let s = -1; s <= 1; s += 2) {
      const r = rc0 + s * rc.halfWidth
      positions.push(r * Math.cos(a), y, r * Math.sin(a))
    }
  }
  for (let i = 0; i < segments; i++) {
    const a0 = i * 2
    indices.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/**
 * Every water surface in the city.
 *
 * There is no single sea level: each terrace holds its canals 3.5 m below its own
 * street, so the radial canals are a staircase of pools falling from the summit to the
 * sea. That is modelled literally — one flat surface per canal per terrace.
 */
export default function Water() {
  const matRef = useRef()

  const canalGeo = useMemo(() => {
    const parts = []
    // One flat surface per canal per terrace: each terrace holds its water 3.5 m below
    // its own street, so a radial canal is a staircase of pools, not one sloping ribbon.
    for (const tier of TIERS) {
      const y = canalWaterY(tier)
      for (const ch of RADIAL_CANALS.channels) {
        const r0 = Math.max(tier.inner, ch.inner)
        const r1 = Math.min(tier.outer, ISLAND_RADIUS)
        if (r1 - r0 < 2) continue
        parts.push(radialChannel(ch, r0, r1, y))
      }
    }
    for (const rc of RING_CANALS) {
      parts.push(ringBand(rc, canalWaterY(TIERS.find((t) => t.id === rc.tier))))
    }
    return parts
  }, [])

  const seaGeo = useMemo(
    () => annularSector({ inner: 396, outer: 4200, startDeg: 0, endDeg: 360, y: 0, segments: 256, radialSteps: 40 }),
    [],
  )

  // A slow swell, kept gentle — this is a calm afternoon, not weather.
  useFrame(({ clock }) => {
    if (matRef.current) {
      const t = clock.elapsedTime
      matRef.current.opacity = 0.86 + Math.sin(t * 0.4) * 0.015
    }
  })

  return (
    <group>
      <mesh geometry={seaGeo} renderOrder={1}>
        <meshStandardMaterial
          ref={matRef}
          color={PALETTE.sea}
          transparent
          opacity={0.88}
          roughness={0.22}
          metalness={0.2}
        />
      </mesh>
      {canalGeo.map((g, i) => (
        <mesh key={i} geometry={g} renderOrder={2}>
          <meshStandardMaterial
            color={PALETTE.canal}
            transparent
            opacity={0.85}
            roughness={0.24}
            metalness={0.18}
          />
        </mesh>
      ))}
    </group>
  )
}
