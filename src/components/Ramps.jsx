import { useMemo } from 'react'
import * as THREE from 'three'
import { RAMP_BEARINGS, RAMP_HALF_WIDTH, DEG, ISLAND_RADIUS } from '../world/config.js'
import { heightAt, isWaterAt } from '../world/terrain.js'
import { allSteps, RISER } from '../world/ramps.js'
import { balustradeGeometry, mergeSimple } from '../world/arch.js'
import { ashlarTexture } from '../world/textures.js'

/**
 * The four ramps, dressed as stepped civic streets.
 *
 * These are the only routes between terraces, so they carry most of the walking — and
 * as bare graded slopes they read as landslides rather than streets.
 *
 * The treads come from world/ramps.js, which is also what the navigation surface reads,
 * so the step you see is the step you stand on. They used to be decoration over a smooth
 * slope, and the player sank straight through them.
 */
function buildGeometry() {
  const treads = allSteps().map((s) => {
    const g = new THREE.BoxGeometry(s.width, RISER * 2.2, s.depth + 0.3)
    g.rotateY(-(s.bearing + 90) * DEG)
    const a = s.bearing * DEG
    // Positioned so the box *top* is the tread; the rest is buried in the slope.
    g.translate(s.rMid * Math.cos(a), s.y - RISER * 1.1, s.rMid * Math.sin(a))
    return g
  })

  const rails = []
  for (const bearing of RAMP_BEARINGS) {
    for (const side of [-1, 1]) {
      for (let r = ISLAND_RADIUS - 16; r > 40; r -= 9) {
        const deg = bearing + side * RAMP_HALF_WIDTH * 0.92
        const a = deg * DEG
        const x = r * Math.cos(a)
        const z = r * Math.sin(a)
        if (isWaterAt(x, z)) continue // the crossings are bridged, not railed
        const g = balustradeGeometry(9.4, 1.35)
        g.rotateY(-(bearing + 90) * DEG + Math.PI / 2)
        g.translate(x, heightAt(x, z), z)
        rails.push(g)
      }
    }
  }

  return { treads: mergeSimple(treads), rails: mergeSimple(rails) }
}

export default function Ramps() {
  const geo = useMemo(buildGeometry, [])
  const stone = useMemo(() => {
    const t = ashlarTexture(512, 5)
    t.repeat.set(3, 1)
    return t
  }, [])

  return (
    <group>
      <mesh geometry={geo.treads} receiveShadow castShadow frustumCulled={false}>
        <meshStandardMaterial map={stone} color="#c0b7a3" roughness={0.95} />
      </mesh>
      <mesh geometry={geo.rails} receiveShadow castShadow frustumCulled={false}>
        <meshStandardMaterial map={stone} color="#cdc4ae" roughness={0.92} />
      </mesh>
    </group>
  )
}
