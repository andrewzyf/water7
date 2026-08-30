import { useMemo } from 'react'
import * as THREE from 'three'
import Batch from './Batch.jsx'
import { generateProps } from '../world/props.js'
import { boatGeometry } from '../world/boatGeometry.js'
import { mergeSimple } from '../world/arch.js'
import { timberTexture, ashlarTexture } from '../world/textures.js'

/** Laundry lines drawn as a single merged mesh — each needs its own 3D orientation. */
function lineGeometry(lines) {
  const parts = []
  const up = new THREE.Vector3(0, 1, 0)
  for (const l of lines) {
    const a = new THREE.Vector3(...l.a)
    const b = new THREE.Vector3(...l.b)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    mid.y -= 0.6 // the line sags
    // Two segments through the sag point read as a catenary at this scale.
    for (const [p, q] of [[a, mid], [mid, b]]) {
      const dir = q.clone().sub(p)
      const len = dir.length()
      const g = new THREE.CylinderGeometry(0.045, 0.045, len, 5)
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize())
      g.applyQuaternion(quat)
      g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2)
      parts.push(g)
    }
  }
  return parts.length ? mergeSimple(parts) : null
}

/**
 * Everything at eye level: quayside lamps and bollards, market awnings, crates and
 * barrels around the yards, laundry across the alleys, and boats moored in the canals.
 */
export default function Props({ buildings }) {
  const props = useMemo(() => generateProps(buildings), [buildings])

  const geos = useMemo(() => ({
    box: new THREE.BoxGeometry(1, 1, 1),
    post: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    bollard: new THREE.CylinderGeometry(0.5, 0.62, 1, 12),
    lantern: new THREE.BoxGeometry(1, 1, 1),
    barrel: new THREE.CylinderGeometry(0.5, 0.44, 1, 12),
    boat: boatGeometry(),
    plane: new THREE.PlaneGeometry(1, 1),
  }), [])

  const tex = useMemo(() => {
    const timber = timberTexture(); timber.repeat.set(2, 1)
    const stone = ashlarTexture(256, 4); stone.repeat.set(1, 1)
    return { timber, stone }
  }, [])

  const lineGeo = useMemo(() => lineGeometry(props.lines), [props.lines])

  // Awnings over some of the moored boats.
  const boatAwnings = useMemo(
    () => props.boats.filter((b) => b.awning).map((b) => ({
      position: [b.position[0], b.position[1] + 1.7, b.position[2]],
      rotation: b.rotation,
      scale: [2.0 * b.scale, 0.16, 3.4 * b.scale],
      color: b.awning,
    })),
    [props.boats],
  )

  return (
    <group>
      <Batch geometry={geos.bollard} items={props.bollards}>
        <meshStandardMaterial map={tex.stone} roughness={0.92} />
      </Batch>

      <Batch geometry={geos.post} items={props.lanternPosts}>
        <meshStandardMaterial roughness={0.55} metalness={0.45} />
      </Batch>
      <Batch geometry={geos.box} items={props.lanternCaps} castShadow={false}>
        <meshStandardMaterial roughness={0.6} metalness={0.4} />
      </Batch>
      <Batch geometry={geos.lantern} items={props.lanternHeads} castShadow={false}>
        {/* Lit glass: emissive so the lamps still read once the sun drops. */}
        <meshStandardMaterial
          emissive="#ffcf7d"
          emissiveIntensity={1.15}
          roughness={0.3}
          transparent
          opacity={0.92}
        />
      </Batch>

      <Batch geometry={geos.box} items={props.crates}>
        <meshStandardMaterial map={tex.timber} roughness={0.94} />
      </Batch>
      <Batch geometry={geos.barrel} items={props.barrels}>
        <meshStandardMaterial map={tex.timber} roughness={0.92} />
      </Batch>

      <Batch geometry={geos.box} items={props.stallTops}>
        <meshStandardMaterial roughness={0.85} />
      </Batch>
      <Batch geometry={geos.post} items={props.stallPosts} receiveShadow={false}>
        <meshStandardMaterial map={tex.timber} roughness={0.9} />
      </Batch>

      {lineGeo && (
        <mesh geometry={lineGeo} castShadow={false} receiveShadow={false} frustumCulled={false}>
          <meshStandardMaterial color="#6b6355" roughness={0.9} />
        </mesh>
      )}
      <Batch geometry={geos.plane} items={props.cloths} castShadow={false}>
        <meshStandardMaterial roughness={0.92} side={THREE.DoubleSide} />
      </Batch>

      <Batch geometry={geos.boat} items={props.boats}>
        <meshStandardMaterial map={tex.timber} roughness={0.88} />
      </Batch>
      <Batch geometry={geos.box} items={boatAwnings} receiveShadow={false}>
        <meshStandardMaterial roughness={0.85} />
      </Batch>
    </group>
  )
}
