/** Geometry helpers for polar-aligned surfaces (canal beds, quays, water bands). */
import * as THREE from 'three'
import { DEG } from './config.js'

/**
 * A flat annular sector lying in the XZ plane at height y.
 * Used for every water surface, since the whole city is laid out in polar coordinates.
 */
export function annularSector({ inner, outer, startDeg, endDeg, y = 0, segments = 64, radialSteps = 1 }) {
  const positions = []
  const indices = []
  const span = endDeg - startDeg
  for (let j = 0; j <= radialSteps; j++) {
    const r = inner + (outer - inner) * (j / radialSteps)
    for (let i = 0; i <= segments; i++) {
      const a = (startDeg + (span * i) / segments) * DEG
      positions.push(r * Math.cos(a), y, r * Math.sin(a))
    }
  }
  const stride = segments + 1
  for (let j = 0; j < radialSteps; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * stride + i
      // Wound CCW seen from above, so the normal points up.
      indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Merge a list of geometries into one (avoids a BufferGeometryUtils import). */
export function mergeGeometries(geos) {
  const positions = []
  const normals = []
  const indices = []
  let offset = 0
  for (const g of geos) {
    const p = g.attributes.position.array
    const n = g.attributes.normal.array
    positions.push(...p)
    normals.push(...n)
    const idx = g.index ? g.index.array : [...Array(p.length / 3).keys()]
    for (let i = 0; i < idx.length; i++) indices.push(idx[i] + offset)
    offset += p.length / 3
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  out.setIndex(indices)
  return out
}
