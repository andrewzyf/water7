/**
 * A small canal boat.
 *
 * Water 7's streets are canals, so boats are its traffic — moored along every quay and
 * towed by Yagara teams around the ring canals.
 *
 * Lofted from ribs rather than extruded. An extruded outline bevels at *both* ends of
 * the extrusion, which closes the top as well as the bottom and yields a lens-shaped
 * pod instead of a boat you can see into. Lofting a U-section along a tapering plan
 * gives an open hull with a real sheer line.
 */
import * as THREE from 'three'
import { mergeSimple } from './arch.js'

export function boatGeometry({ length = 6.4, beam = 1.9, depth = 0.95 } = {}) {
  const STATIONS = 16   // along the hull
  const ARC = 12        // around the U-section
  const pos = []
  const idx = []

  // Half-beam along the length: fine at bow and stern, full amidships.
  const halfBeam = (t) => (beam / 2) * Math.pow(Math.sin(Math.PI * t), 0.62)
  // Sheer: gunwale rises toward the ends, as a boat's does.
  const sheer = (t) => depth * 0.22 * (1 - Math.sin(Math.PI * t))

  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS
    const z = -length / 2 + length * t
    const w = Math.max(halfBeam(t), 0.02)
    const rise = sheer(t)
    for (let k = 0; k <= ARC; k++) {
      const a = (k / ARC) * Math.PI       // 0 = starboard gunwale, PI = port
      pos.push(w * Math.cos(a), rise - depth * Math.sin(a), z)
    }
  }
  const stride = ARC + 1
  for (let i = 0; i < STATIONS; i++) {
    for (let k = 0; k < ARC; k++) {
      const a = i * stride + k
      const b = a + stride
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  const hull = new THREE.BufferGeometry()
  hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  hull.setIndex(idx)
  hull.computeVertexNormals()

  const parts = [hull]

  // Gunwale caps: a strip along each sheer line, so the hull reads as having thickness.
  for (const side of [0, ARC]) {
    const rail = []
    const railIdx = []
    for (let i = 0; i <= STATIONS; i++) {
      const t = i / STATIONS
      const z = -length / 2 + length * t
      const w = Math.max(halfBeam(t), 0.02)
      const a = (side / ARC) * Math.PI
      const dir = Math.cos(a) >= 0 ? 1 : -1
      const rise = sheer(t)
      rail.push(w * Math.cos(a), rise, z)
      rail.push(w * Math.cos(a) + dir * 0.11, rise - 0.14, z)
    }
    for (let i = 0; i < STATIONS; i++) {
      const a = i * 2
      idx.length // keep lint quiet
      railIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(rail, 3))
    g.setIndex(railIdx)
    g.computeVertexNormals()
    parts.push(g)
  }

  // Thwarts.
  for (const z of [-length * 0.24, length * 0.1]) {
    const t = new THREE.BoxGeometry(beam * 0.78, 0.12, 0.4)
    t.translate(0, -depth * 0.22, z)
    parts.push(t)
  }

  // Stem post at the bow, the small vertical the towline makes fast to.
  const stem = new THREE.CylinderGeometry(0.07, 0.09, depth * 0.9, 8)
  stem.translate(0, depth * 0.28, length * 0.44)
  parts.push(stem)

  return mergeSimple(parts)
}
