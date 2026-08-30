/**
 * A Yagara Bull.
 *
 * Water 7's canals are its streets, and Yagara Bulls are its traffic — seahorse-like
 * mounts that tow the gondolas. They are the single most characteristic thing moving
 * around the city, so a canal full of unattended boats reads as a model of Water 7
 * rather than Water 7.
 *
 * Built as two pieces so they can be instanced and animated separately: the body sits
 * in the water, and the head-and-neck bobs on top of it.
 */
import * as THREE from 'three'
import { mergeSimple } from './arch.js'

/** The part that floats: a stout body with fins, half submerged. */
export function yagaraBodyGeometry() {
  const parts = []

  const body = new THREE.SphereGeometry(1, 18, 14)
  body.scale(1.15, 1.15, 2.1)
  parts.push(body)

  // Haunches, so the silhouette is not a plain egg.
  const rump = new THREE.SphereGeometry(1, 14, 10)
  rump.scale(1.0, 0.95, 1.1)
  rump.translate(0, -0.1, -1.6)
  parts.push(rump)

  // Side fins.
  for (const s of [-1, 1]) {
    const fin = new THREE.SphereGeometry(0.72, 10, 8)
    fin.scale(1.5, 0.22, 0.85)
    fin.rotateZ(s * 0.34)
    fin.translate(s * 1.3, -0.15, 0.35)
    parts.push(fin)
  }

  // Dorsal ridge.
  const ridge = new THREE.ConeGeometry(0.42, 1.2, 8)
  ridge.rotateX(Math.PI / 2)
  ridge.scale(0.5, 1, 2.4)
  ridge.translate(0, 0.95, -0.6)
  parts.push(ridge)

  return mergeSimple(parts)
}

/** Neck, head and snout — a seahorse's curve, ending in the heavy muzzle. */
export function yagaraHeadGeometry() {
  const parts = []

  // Neck: segments stepping along an arc, tapering as they rise.
  const SEG = 6
  for (let i = 0; i < SEG; i++) {
    const t = i / (SEG - 1)
    const r = 0.72 - t * 0.24
    const a = t * 0.95
    const seg = new THREE.SphereGeometry(r, 12, 9)
    seg.scale(1, 1, 1.15)
    seg.translate(0, t * 2.5, Math.sin(a) * 1.15)
    parts.push(seg)
  }

  // Skull.
  const skull = new THREE.SphereGeometry(0.62, 14, 11)
  skull.scale(1.05, 1.0, 1.25)
  skull.translate(0, 2.62, 1.2)
  parts.push(skull)

  // Snout, tapering to a heavy muzzle.
  const snout = new THREE.CylinderGeometry(0.3, 0.46, 1.5, 12)
  snout.rotateX(Math.PI / 2 + 0.22)
  snout.translate(0, 2.44, 2.0)
  parts.push(snout)

  const muzzle = new THREE.SphereGeometry(0.36, 12, 9)
  muzzle.scale(1.15, 0.9, 0.9)
  muzzle.translate(0, 2.28, 2.7)
  parts.push(muzzle)

  // Ears.
  for (const s of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.17, 0.6, 8)
    ear.rotateZ(s * 0.42)
    ear.translate(s * 0.36, 3.16, 1.0)
    parts.push(ear)
  }

  return mergeSimple(parts)
}

/** Eyes and harness, kept separate so they can take their own material. */
export function yagaraTrimGeometry() {
  const parts = []
  for (const s of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.15, 10, 8)
    eye.translate(s * 0.5, 2.72, 1.62)
    parts.push(eye)
    const nostril = new THREE.SphereGeometry(0.075, 8, 6)
    nostril.translate(s * 0.17, 2.36, 2.94)
    parts.push(nostril)
  }
  // Harness band round the neck.
  const band = new THREE.TorusGeometry(0.62, 0.09, 6, 16)
  band.rotateX(0.5)
  band.translate(0, 1.5, 0.55)
  parts.push(band)
  return mergeSimple(parts)
}
