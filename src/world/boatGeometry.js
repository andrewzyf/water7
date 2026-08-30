/**
 * A small canal boat.
 *
 * Water 7's streets are canals, so the boats are its traffic — moored along every quay
 * and drifting in the ring canals. Built as a pointed hull extruded from a plan outline
 * with a bevelled bottom, which gives the tapered draught of a gondola without needing a
 * lofted mesh.
 */
import * as THREE from 'three'
import { mergeSimple } from './arch.js'

export function boatGeometry({ length = 6.4, beam = 1.9, depth = 0.95 } = {}) {
  const shape = new THREE.Shape()
  const hl = length / 2
  const hb = beam / 2
  shape.moveTo(0, hl)                                   // bow
  shape.bezierCurveTo(hb * 1.1, hl * 0.5, hb, -hl * 0.3, 0, -hl)   // starboard to stern
  shape.bezierCurveTo(-hb, -hl * 0.3, -hb * 1.1, hl * 0.5, 0, hl)  // port back to bow

  const hull = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.72,
    bevelSize: hb * 0.72,
    bevelSegments: 3,
    curveSegments: 14,
  })
  hull.rotateX(Math.PI / 2)
  hull.translate(0, depth * 0.5, 0)

  const parts = [hull]

  // Gunwale, so the sheer line catches the light.
  const rim = new THREE.TorusGeometry(hl * 0.62, 0.09, 6, 22)
  rim.rotateX(Math.PI / 2)
  rim.scale(hb / (hl * 0.62) * 1.02, 1, 1.0)
  rim.translate(0, depth * 0.52, 0)
  parts.push(rim)

  // Thwarts.
  for (const z of [-hl * 0.28, hl * 0.1]) {
    const t = new THREE.BoxGeometry(beam * 0.82, 0.14, 0.42)
    t.translate(0, depth * 0.42, z)
    parts.push(t)
  }

  return mergeSimple(parts)
}
