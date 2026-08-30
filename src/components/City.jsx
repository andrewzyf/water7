import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../world/palette.js'

/** Triangular-prism roof: unit footprint, ridge running along local Z. */
function prismGeometry() {
  const g = new THREE.BufferGeometry()
  const v = new Float32Array([
    // +X slope
    0.5, 0, -0.5, 0, 1, -0.5, 0, 1, 0.5,
    0.5, 0, -0.5, 0, 1, 0.5, 0.5, 0, 0.5,
    // -X slope
    -0.5, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5,
    -0.5, 0, 0.5, 0, 1, -0.5, -0.5, 0, -0.5,
    // gable ends
    -0.5, 0, -0.5, 0, 1, -0.5, 0.5, 0, -0.5,
    0.5, 0, 0.5, 0, 1, 0.5, -0.5, 0, 0.5,
  ])
  g.setAttribute('position', new THREE.BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
}

/** One InstancedMesh driven by a list of {matrix, color}. */
function Batch({ geometry, items, material }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      e.set(0, it.rotation, 0)
      q.setFromEuler(e)
      m.compose(
        new THREE.Vector3(...it.position),
        q,
        new THREE.Vector3(...it.scale),
      )
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, new THREE.Color(it.color))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])

  if (items.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, items.length]}
      castShadow
      receiveShadow
    >
      {material}
    </instancedMesh>
  )
}

/**
 * The residential terraces, drawn as instanced massing.
 *
 * Even at blockout fidelity the silhouette matters more than detail, so the roofs are
 * already the right *form*: half-barrel vaults with the arc facing the street, which
 * is the single shape that makes a skyline read as Water 7.
 */
export default function City({ buildings }) {
  const geos = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const barrel = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1)
    barrel.rotateX(Math.PI / 2) // ridge now runs along local Z
    const dome = new THREE.SphereGeometry(0.5, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2)
    return { box, barrel, dome, prism: prismGeometry() }
  }, [])

  const { walls, barrels, prisms, domes } = useMemo(() => {
    const walls = []
    const barrels = []
    const prisms = []
    const domes = []
    for (const b of buildings) {
      // Sunk slightly so the box does not float where the ground falls away beneath it.
      walls.push({
        position: [b.x, b.y + b.height / 2 - 0.9, b.z],
        rotation: b.rotation,
        scale: [b.width, b.height, b.depth],
        color: b.wall,
      })
      const top = b.y + b.height - 0.9
      if (b.roof === 'barrel') {
        // Radius = half the street frontage, flattened to a segmental vault. A full
        // half-round balloons over the walls and shows its dark underside; the
        // reference roofs sit lower and barely overhang.
        barrels.push({
          position: [b.x, top, b.z],
          rotation: b.rotation,
          // Depth kept just inside the wall face, so the vault's lower half stays
          // buried and only the arc of the gable shows.
          scale: [b.width * 1.0, b.width * 0.58, b.depth * 0.98],
          color: b.roofColor,
        })
      } else if (b.roof === 'pitch') {
        prisms.push({
          position: [b.x, top, b.z],
          rotation: b.rotation,
          scale: [b.width * 1.04, b.width * 0.36, b.depth * 1.03],
          color: b.roofColor,
        })
      } else {
        domes.push({
          position: [b.x, top, b.z],
          rotation: b.rotation,
          scale: [b.width * 1.0, b.width * 0.5, b.depth * 1.0],
          color: b.roofColor,
        })
      }
    }
    return { walls, barrels, prisms, domes }
  }, [buildings])

  return (
    <group>
      <Batch
        geometry={geos.box}
        items={walls}
        material={<meshStandardMaterial roughness={0.9} metalness={0} />}
      />
      <Batch
        geometry={geos.barrel}
        items={barrels}
        material={<meshStandardMaterial roughness={0.78} metalness={0} />}
      />
      <Batch
        geometry={geos.prism}
        items={prisms}
        material={<meshStandardMaterial roughness={0.78} metalness={0} side={THREE.DoubleSide} />}
      />
      <Batch
        geometry={geos.dome}
        items={domes}
        material={<meshStandardMaterial roughness={0.78} metalness={0} />}
      />
    </group>
  )
}
