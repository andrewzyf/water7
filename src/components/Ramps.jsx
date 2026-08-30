import { useMemo } from 'react'
import * as THREE from 'three'
import { RAMP_BEARINGS, RAMP_HALF_WIDTH, DEG, ISLAND_RADIUS, TIERS } from '../world/config.js'
import { heightAt } from '../world/terrain.js'
import { balustradeGeometry, mergeSimple } from '../world/arch.js'
import { ashlarTexture } from '../world/textures.js'

/**
 * The four ramps, dressed as stepped streets.
 *
 * These are the only routes between terraces, so they carry most of the walking in the
 * game — and as bare graded slopes they read as landslides rather than streets. Treads
 * are laid on the existing surface wherever the ground is steep enough to warrant steps,
 * with balustrades down both sides.
 *
 * The steps are dressing, not collision: the player still walks the smooth height field
 * underneath, deviating by at most half a riser (~0.2 m), which is imperceptible and
 * avoids splitting the navigation rules between two representations.
 */

const RISER = 0.42
const STEP_WIDTH_DEG = RAMP_HALF_WIDTH * 0.72

function buildRampGeometry() {
  const treads = []
  const rails = []

  for (const bearing of RAMP_BEARINGS) {
    // Walk from the shore up to the summit, laying a tread wherever the ground rises
    // enough since the last one.
    const samples = []
    for (let r = ISLAND_RADIUS - 14; r > 34; r -= 0.6) {
      const a = bearing * DEG
      samples.push({ r, y: heightAt(r * Math.cos(a), r * Math.sin(a)) })
    }

    let lastY = samples[0].y
    let lastR = samples[0].r
    for (const s of samples) {
      if (Math.abs(s.y - lastY) < RISER) continue
      const rMid = (s.r + lastR) / 2
      const halfDeg = STEP_WIDTH_DEG
      const width = halfDeg * 2 * DEG * rMid
      const depth = Math.abs(lastR - s.r) + 0.35
      const g = new THREE.BoxGeometry(width, RISER * 1.5, depth)
      g.rotateY(-(bearing + 90) * DEG)
      const a = bearing * DEG
      g.translate(rMid * Math.cos(a), (s.y + lastY) / 2, rMid * Math.sin(a))
      treads.push(g)
      lastY = s.y
      lastR = s.r
    }

    // Balustrades down both edges, following the ground.
    for (const side of [-1, 1]) {
      for (let r = ISLAND_RADIUS - 16; r > 40; r -= 9) {
        const deg = bearing + side * RAMP_HALF_WIDTH * 0.92
        const a = deg * DEG
        const x = r * Math.cos(a)
        const z = r * Math.sin(a)
        const y = heightAt(x, z)
        const g = balustradeGeometry(9.4, 1.35)
        g.rotateY(-(bearing + 90) * DEG + Math.PI / 2)
        g.translate(x, y, z)
        rails.push(g)
      }
    }
  }
  return { treads: mergeSimple(treads), rails: mergeSimple(rails) }
}

export default function Ramps() {
  const geo = useMemo(buildRampGeometry, [])
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
