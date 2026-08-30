import { useMemo } from 'react'
import * as THREE from 'three'
import { BRIDGES } from '../world/bridges.js'
import { DEG } from '../world/config.js'
import { PALETTE } from '../world/palette.js'
import { ashlarTexture } from '../world/textures.js'

/**
 * The stone footbridges, drawn from the same list the height field uses — so what you
 * see is exactly what you can walk on. Each deck is a parabolic arch landing flush
 * with the street at both ends.
 */
export default function Bridges() {
  const geometry = useMemo(() => {
    const positions = []
    const uvs = []
    const indices = []
    const HALF_W = 3.8
    const RISE = 1.9
    const STEPS = 10
    const THICK = 0.9
    let base = 0

    for (const br of BRIDGES) {
      const a = br.bearing * DEG
      const dir = [Math.cos(a), Math.sin(a)]        // radial
      const tan = [-Math.sin(a), Math.cos(a)]       // tangential
      // 'across' runs along the deck; 'along' is its width.
      const acrossVec = br.kind === 'radial' ? tan : dir
      const alongVec = br.kind === 'radial' ? dir : tan
      const cx = br.radius * dir[0]
      const cz = br.radius * dir[1]

      for (let i = 0; i <= STEPS; i++) {
        const t = -1 + (2 * i) / STEPS
        const s = t * br.span
        const y = br.y + RISE * (1 - t * t)
        for (let w = -1; w <= 1; w += 2) {
          const px = cx + acrossVec[0] * s + alongVec[0] * w * HALF_W
          const pz = cz + acrossVec[1] * s + alongVec[1] * w * HALF_W
          positions.push(px, y, pz)          // deck
          uvs.push((w + 1) / 2, t * 2.4)
          positions.push(px, y - THICK, pz)  // soffit
          uvs.push((w + 1) / 2, t * 2.4)
        }
      }
      // 4 verts per step: [L-top, L-bot, R-top, R-bot]
      for (let i = 0; i < STEPS; i++) {
        const o = base + i * 4
        const n = o + 4
        indices.push(o, n, o + 2, o + 2, n, n + 2)             // deck
        indices.push(o + 1, o + 3, n + 1, o + 3, n + 3, n + 1) // soffit
        indices.push(o, o + 1, n, o + 1, n + 1, n)             // left edge
        indices.push(o + 2, n + 2, o + 3, o + 3, n + 2, n + 3) // right edge
      }
      base += (STEPS + 1) * 4
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  }, [])

  const stone = useMemo(() => {
    const t = ashlarTexture(512, 6)
    t.repeat.set(1, 1)
    return t
  }, [])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        map={stone}
        color={PALETTE.quay}
        roughness={0.92}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
