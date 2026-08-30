import { useMemo } from 'react'
import * as THREE from 'three'
import { buildIslandGeometry } from '../world/terrain.js'
import { PALETTE } from '../world/palette.js'
import { createTerrainMaterial } from '../world/terrainMaterial.js'

const c = (hex) => new THREE.Color(hex)
const SEABED = c('#4a5f63')
const SHORE = c('#c9bda0')
const QUAY = c(PALETTE.quay)
const WALL = c(PALETTE.ashlar)
const WALL_DARK = c(PALETTE.ashlarDark)
const BED = c('#5c6f63')

/**
 * The island itself, built from the analytic height field.
 *
 * Vertex colours are derived from height and surface normal rather than authored:
 * anything steep is read as a retaining wall and gets ashlar grey, flat ground above
 * the waterline gets quay stone, and everything below gets bed or seabed. That single
 * rule is what makes the terraces legible in the blockout.
 */
export default function Island() {
  const geometry = useMemo(() => {
    const geo = buildIslandGeometry(THREE, { radialSegments: 640, ringSegments: 240 })
    const pos = geo.attributes.position
    const nrm = geo.attributes.normal
    const colors = new Float32Array(pos.count * 3)
    const tmp = new THREE.Color()

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const ny = nrm.getY(i)
      const r = Math.hypot(pos.getX(i), pos.getZ(i))

      if (ny < 0.62) {
        // Steep: a terrace retaining wall or a canal side.
        tmp.copy(y < 2 ? WALL_DARK : WALL)
      } else if (y < -6) {
        tmp.copy(SEABED)
      } else if (y < 0.4) {
        tmp.copy(r > 380 ? SHORE : BED)
      } else {
        tmp.copy(QUAY)
      }
      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  const material = useMemo(createTerrainMaterial, [])

  return <mesh geometry={geometry} material={material} receiveShadow castShadow />
}
