import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { generateDetail } from '../world/buildingDetail.js'
import { plasterTexture, roofTileTexture, roofArcTexture, ashlarTexture, timberTexture, windowTexture } from '../world/textures.js'

/** Triangular-prism roof: unit footprint, ridge running along local Z. */
function prismGeometry() {
  const g = new THREE.BufferGeometry()
  const v = new Float32Array([
    0.5, 0, -0.5, 0, 1, -0.5, 0, 1, 0.5,
    0.5, 0, -0.5, 0, 1, 0.5, 0.5, 0, 0.5,
    -0.5, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5,
    -0.5, 0, 0.5, 0, 1, -0.5, -0.5, 0, -0.5,
    -0.5, 0, -0.5, 0, 1, -0.5, 0.5, 0, -0.5,
    0.5, 0, 0.5, 0, 1, 0.5, -0.5, 0, 0.5,
  ])
  g.setAttribute('position', new THREE.BufferAttribute(v, 3))
  const uv = new Float32Array(v.length / 3 * 2)
  for (let i = 0; i < v.length / 3; i++) {
    uv[i * 2] = v[i * 3] + 0.5
    uv[i * 2 + 1] = v[i * 3 + 2] + 0.5
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** One InstancedMesh driven by a list of {position, rotation, scale, color}. */
function Batch({ geometry, items, children, castShadow = true, receiveShadow = true }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const v = new THREE.Vector3()
    const s = new THREE.Vector3()
    const col = new THREE.Color()
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      e.set(0, it.rotation, 0)
      q.setFromEuler(e)
      v.set(...it.position)
      s.set(...it.scale)
      m.compose(v, q, s)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, col.set(it.color))
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
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {children}
    </instancedMesh>
  )
}

/**
 * The residential terraces.
 *
 * Roofs are the half-barrel vaults that make a Water 7 skyline recognisable, and they
 * carry the detail that matters most: ribbed terracotta along the vault, and the banded
 * concentric arc on the gable end facing the street. The cylinder's side and cap take
 * different textures via geometry groups, so one instanced mesh does both.
 */
export default function City({ buildings }) {
  const geos = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const barrel = new THREE.CylinderGeometry(0.5, 0.5, 1, 22, 1)
    barrel.rotateX(Math.PI / 2) // ridge along local Z, banded cap facing the street
    const dome = new THREE.SphereGeometry(0.5, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2)
    return { box, barrel, dome, prism: prismGeometry(), windowQuad: new THREE.PlaneGeometry(1, 1) }
  }, [])

  const tex = useMemo(() => ({
    plaster: plasterTexture(),
    tile: roofTileTexture(),
    arc: roofArcTexture(),
    ashlar: ashlarTexture(256, 5),
    timber: timberTexture(),
    window: windowTexture(),
  }), [])

  useMemo(() => {
    tex.plaster.repeat.set(3, 3)
    tex.tile.repeat.set(2, 1)
    tex.ashlar.repeat.set(2, 1)
  }, [tex])

  const { walls, barrels, prisms, domes } = useMemo(() => {
    const walls = []
    const barrels = []
    const prisms = []
    const domes = []
    for (const b of buildings) {
      walls.push({
        position: [b.x, b.y + b.height / 2 - 0.9, b.z],
        rotation: b.rotation,
        scale: [b.width, b.height, b.depth],
        color: b.wall,
      })
      const top = b.y + b.height - 0.9
      if (b.roof === 'barrel') {
        barrels.push({
          position: [b.x, top, b.z],
          rotation: b.rotation,
          // Depth < 1 keeps the cap recessed inside the gable wall: the buried lower
          // half stays hidden and you read a semicircular arch, not a full disc.
          scale: [b.width * 1.04, b.width * 0.62, b.depth * 0.98],
          color: b.roofColor,
        })
      } else if (b.roof === 'pitch') {
        prisms.push({
          position: [b.x, top, b.z],
          rotation: b.rotation,
          scale: [b.width * 1.05, b.width * 0.4, b.depth * 1.0],
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

  const detail = useMemo(() => generateDetail(buildings), [buildings])

  return (
    <group>
      <Batch geometry={geos.box} items={walls}>
        <meshStandardMaterial map={tex.plaster} roughness={0.92} metalness={0} />
      </Batch>

      {/* Side (ribbed tile) and end caps (banded arc) get different maps. */}
      <Batch geometry={geos.barrel} items={barrels}>
        <meshStandardMaterial attach="material-0" map={tex.tile} roughness={0.8} />
        <meshStandardMaterial attach="material-1" map={tex.arc} roughness={0.85} />
        <meshStandardMaterial attach="material-2" map={tex.arc} roughness={0.85} />
      </Batch>

      <Batch geometry={geos.prism} items={prisms}>
        <meshStandardMaterial map={tex.tile} roughness={0.8} side={THREE.DoubleSide} />
      </Batch>
      <Batch geometry={geos.dome} items={domes}>
        <meshStandardMaterial map={tex.tile} roughness={0.8} />
      </Batch>

      <Batch geometry={geos.box} items={detail.plinths}>
        <meshStandardMaterial map={tex.ashlar} roughness={0.95} />
      </Batch>
      <Batch geometry={geos.box} items={detail.cornices}>
        <meshStandardMaterial roughness={0.9} />
      </Batch>
      <Batch geometry={geos.windowQuad} items={detail.windows} castShadow={false} receiveShadow={false}>
        <meshStandardMaterial
          map={tex.window}
          transparent
          alphaTest={0.35}
          roughness={0.55}
          side={THREE.DoubleSide}
        />
      </Batch>
      <Batch geometry={geos.box} items={detail.doors} castShadow={false}>
        <meshStandardMaterial map={tex.timber} roughness={0.85} />
      </Batch>
      <Batch geometry={geos.box} items={detail.chimneys}>
        <meshStandardMaterial map={tex.plaster} roughness={0.93} />
      </Batch>
      <Batch geometry={geos.box} items={detail.chimneyCaps}>
        <meshStandardMaterial map={tex.ashlar} roughness={0.95} />
      </Batch>
    </group>
  )
}
