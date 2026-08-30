/**
 * Facade detail for the procedural city.
 *
 * Massing alone reads as a blockout no matter how good the silhouette is; what makes a
 * building look built is the stuff at human scale — a stone plinth at the pavement, a
 * cornice under the eaves, recessed windows with pale frames and lavender glass, a door
 * onto the street, chimneys breaking the roofline.
 *
 * Everything here is emitted as flat instance lists so the whole city stays a handful
 * of draw calls.
 */
import { PALETTE } from './palette.js'
import { makeRng, rand } from './rng.js'

/** Building-local (x, y, z) -> world. Local X is the frontage, local Z the depth. */
function toWorld(b, lx, ly, lz) {
  const c = Math.cos(b.rotation)
  const s = Math.sin(b.rotation)
  return [
    b.x + lx * c + lz * s,
    b.y + ly,
    b.z - lx * s + lz * c,
  ]
}

const WINDOW_W = 2.15   // includes the surround and folded shutters
const WINDOW_H = 2.55
const STOREY_MIN = 3.6

/** Outward normal, face rotation offset, and which local axis the face runs along. */
const FACES = [
  { n: [0, 0, 1], yaw: 0, axis: 'x' },            // onto the terrace street
  { n: [0, 0, -1], yaw: Math.PI, axis: 'x' },
  { n: [1, 0, 0], yaw: Math.PI / 2, axis: 'z' },  // onto the radial lane
  { n: [-1, 0, 0], yaw: -Math.PI / 2, axis: 'z' },
]

export function generateDetail(buildings, seed = 90210) {
  const rng = makeRng(seed)
  const plinths = []
  const cornices = []
  const windows = []
  const doors = []
  const chimneys = []
  const chimneyCaps = []

  for (const b of buildings) {
    const hw = b.width / 2
    const hd = b.depth / 2
    const top = b.height - 0.9 // matches the wall sink in City

    // --- plinth: a stone base course that also reaches down to the lowest corner, so
    // buildings on the terraces' sloping ground sit on rock instead of hovering ---
    const footing = b.footing ?? 1.5
    plinths.push({
      position: toWorld(b, 0, 0.9 - footing / 2, 0),
      rotation: b.rotation,
      scale: [b.width + 0.65, footing + 1.8, b.depth + 0.65],
      color: PALETTE.quay,
    })

    // --- cornice: a shadow line under the eaves ---
    cornices.push({
      position: toWorld(b, 0, top - 0.35, 0),
      rotation: b.rotation,
      scale: [b.width + 0.8, 0.7, b.depth + 0.8],
      color: '#efe6d3',
    })

    // --- windows ---
    const storeys = Math.max(1, Math.floor((top - 1.9) / STOREY_MIN))
    const storeyH = (top - 1.9) / storeys

    for (let fi = 0; fi < FACES.length; fi++) {
      const f = FACES[fi]
      const off = f.axis === 'x' ? hd : hw
      const span = f.axis === 'x' ? b.width : b.depth
      const cols = Math.max(1, Math.floor(span / 3.4))
      for (let s = 0; s < storeys; s++) {
        const y = 1.9 + storeyH * (s + 0.55)
        for (let c = 0; c < cols; c++) {
          if (rng() < 0.1) continue // blank panels, blocked-up openings
          const u = -span / 2 + (span / cols) * (c + 0.5)
          const lx = f.axis === 'x' ? u : f.n[0] * off
          const lz = f.axis === 'x' ? f.n[2] * off : u
          windows.push({
            // A hair proud of the wall so the quad never z-fights with it.
            position: toWorld(b, lx + f.n[0] * 0.06, y, lz + f.n[2] * 0.06),
            rotation: b.rotation + f.yaw,
            scale: [WINDOW_W, WINDOW_H, 1],
            color: '#ffffff',
          })
        }
      }

      if (fi === 0) {
        doors.push({
          position: toWorld(b, 0, 1.55, f.n[2] * (hd + 0.13)),
          rotation: b.rotation,
          scale: [1.6, 3.0, 0.26],
          color: rng() < 0.5 ? PALETTE.timberDark : '#5a6f7a',
        })
      }
    }

    // --- chimneys ---
    // They have to sit *on* the vault, so the stack's base follows the barrel's curve
    // rather than a flat roofline; otherwise they hang off the side like loose planks.
    const nCh = rng() < 0.55 ? 1 : rng() < 0.5 ? 2 : 0
    const radX = b.width * 0.52
    const radY = b.width * 0.31
    for (let i = 0; i < nCh; i++) {
      const lx = rand(rng, -hw * 0.26, hw * 0.26)
      const lz = rand(rng, -hd * 0.34, hd * 0.34)
      const vault = b.roof === 'barrel'
        ? radY * Math.sqrt(Math.max(0, 1 - (lx / radX) ** 2))
        : b.width * 0.2
      const h = rand(rng, 2.2, 3.4)
      chimneys.push({
        position: toWorld(b, lx, top + vault + h / 2 - 0.5, lz),
        rotation: b.rotation,
        scale: [1.25, h, 1.25],
        color: '#b08a72',
      })
      // Capping slab, so the stack terminates instead of just stopping.
      chimneyCaps.push({
        position: toWorld(b, lx, top + vault + h - 0.35, lz),
        rotation: b.rotation,
        scale: [1.75, 0.36, 1.75],
        color: '#8d8578',
      })
    }
  }

  return { plinths, cornices, windows, doors, chimneys, chimneyCaps }
}
