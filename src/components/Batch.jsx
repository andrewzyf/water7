import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * One InstancedMesh from a list of {position, rotation (yaw), scale, color}.
 * Shared by the city, its facade detail and the street props, so the whole island stays
 * a couple of dozen draw calls.
 */
function InstancedGroup({
  geometry, items, children, castShadow, receiveShadow, renderOrder,
}) {
  const ref = useRef()

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh || !items.length) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const v = new THREE.Vector3()
    const s = new THREE.Vector3()
    const col = new THREE.Color()
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      e.set(0, it.rotation ?? 0, 0)
      q.setFromEuler(e)
      v.set(...it.position)
      const sc = it.scale
      s.set(...(typeof sc === 'number' ? [sc, sc, sc] : sc))
      m.compose(v, q, s)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, col.set(it.color ?? '#ffffff'))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])

  if (!items.length) return null
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      renderOrder={renderOrder}
    >
      {children}
    </instancedMesh>
  )
}

/**
 * Spatially chunked instancing.
 *
 * A single InstancedMesh covering the whole island has a bounding sphere the size of
 * the island, so frustum culling can never reject it — every window on Water 7 is
 * submitted even when you are looking out to sea. Splitting the instances into spatial
 * cells gives each batch a tight bounds, so the GPU only sees what is roughly in view.
 * The cost is a few more draw calls; the saving is most of the geometry most of the
 * time.
 */
export default function Batch({
  geometry, items, children, castShadow = true, receiveShadow = true, renderOrder,
  chunkSize = 150,
}) {
  const chunks = useMemo(() => {
    if (!items.length) return []
    // Below this it is not worth the extra draw calls.
    if (items.length < 400 || !chunkSize) return [items]
    const cells = new Map()
    for (const it of items) {
      const key = `${Math.round(it.position[0] / chunkSize)},${Math.round(it.position[2] / chunkSize)}`
      let cell = cells.get(key)
      if (!cell) { cell = []; cells.set(key, cell) }
      cell.push(it)
    }
    return [...cells.values()]
  }, [items, chunkSize])

  return chunks.map((chunk, i) => (
    <InstancedGroup
      key={i}
      geometry={geometry}
      items={chunk}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      renderOrder={renderOrder}
    >
      {children}
    </InstancedGroup>
  ))
}
