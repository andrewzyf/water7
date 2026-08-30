import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RING_CANALS, TIERS, DEG, canalWaterY, tierById } from '../world/config.js'
import { ringRadiusAt } from '../world/shape.js'
import { isWaterAt } from '../world/terrain.js'
import { boatGeometry } from '../world/boatGeometry.js'
import { yagaraBodyGeometry, yagaraHeadGeometry, yagaraTrimGeometry } from '../world/yagaraGeometry.js'
import { makeRng, rand, pick } from '../world/rng.js'
import { trafficState } from '../world/trafficState.js'
import { timberTexture } from '../world/textures.js'

/**
 * Living canal traffic: Yagara Bull teams towing gondolas around the ring canals.
 *
 * The canals are Water 7's streets, so still water full of moored hulls reads as a model
 * of the city rather than the city. Each team runs a lap of its ring canal at its own
 * speed and lane offset, the bull leading the boat by a fixed tow length, both bobbing
 * on the swell.
 *
 * Positions are recomputed from the ring's own radius function every frame, so the
 * traffic follows the canal wherever it bows in and out — the same centreline the water
 * surface and the coping stones are built from.
 */

const HIDE = new THREE.Matrix4().makeScale(0, 0, 0)

function buildTraffic() {
  const rng = makeRng(5150)
  const out = []
  for (const rc of RING_CANALS) {
    const tier = tierById(rc.tier)
    const y = rc.tier === 0 ? 0 : canalWaterY(tier)
    const count = rc.tier === 0 ? 30 : 24
    for (let i = 0; i < count; i++) {
      const dir = rng() < 0.5 ? 1 : -1
      out.push({
        rc,
        y,
        phase: rand(rng, 0, 360),
        // Degrees per second: a slow working pace either way round the ring.
        speed: dir * rand(rng, 0.55, 1.15) * (rc.tier === 0 ? 1 : 0.85),
        // Keep to one side, as traffic does.
        lane: dir * rand(rng, 0.24, 0.62) * (rc.halfWidth - 3),
        bob: rand(rng, 0, Math.PI * 2),
        scale: rand(rng, 0.9, 1.15),
        // Yagara are big animals — comparable in bulk to the boat they tow.
        bull: rand(rng, 1.25, 1.55),
        hull: pick(rng, ['#7a5c3a', '#6b6f78', '#8a5340', '#5f6b52']),
        hide: pick(rng, ['#8fa9b8', '#a4b6a0', '#b0a292', '#94a8bb']),
      })
    }
  }
  return out
}

/** Tow length between the bull's body and the bow it is pulling, in metres. */
const TOW = 5.4

export default function CanalTraffic() {
  const traffic = useMemo(buildTraffic, [])
  const boats = useRef()
  const bodies = useRef()
  const heads = useRef()
  const trims = useRef()

  const geos = useMemo(() => ({
    boat: boatGeometry({ length: 7.2, beam: 2.3, depth: 1.05 }),
    body: yagaraBodyGeometry(),
    head: yagaraHeadGeometry(),
    trim: yagaraTrimGeometry(),
  }), [])

  const timber = useMemo(() => {
    const t = timberTexture()
    t.repeat.set(2, 1)
    return t
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    const col = new THREE.Color()

    for (let i = 0; i < traffic.length; i++) {
      const it = traffic[i]
      const deg = (it.phase + t * it.speed) % 360
      const r = ringRadiusAt(it.rc, deg) + it.lane
      const a = deg * DEG
      const x = r * Math.cos(a)
      const z = r * Math.sin(a)

      // The bull leads along the ring, by the tow length converted to an arc.
      const leadDeg = deg + Math.sign(it.speed) * (TOW / r) / DEG
      const rl = ringRadiusAt(it.rc, leadDeg) + it.lane
      const al = leadDeg * DEG
      const bx = rl * Math.cos(al)
      const bz = rl * Math.sin(al)

      // Heading points from boat toward bull, which is the direction of travel.
      const heading = Math.atan2(bx - x, bz - z)
      const bobBoat = Math.sin(t * 1.3 + it.bob) * 0.09
      const bobBull = Math.sin(t * 1.6 + it.bob * 1.7) * 0.13

      // A team whose lane has wandered onto dry ground is hidden rather than beached —
      // and so is one the player has mounted, since they are driving it themselves now.
      const wet = isWaterAt(x, z) && isWaterAt(bx, bz) && !trafficState.hidden.has(i)

      // Publish for the boarding search.
      const slot = trafficState.teams[i] ?? (trafficState.teams[i] = { x: 0, z: 0, y: 0, tier: 0 })
      slot.x = bx
      slot.z = bz
      slot.y = it.y
      slot.tier = it.rc.tier

      const place = (mesh, px, py, pz, yaw, s, roll = 0) => {
        if (!mesh.current) return
        if (!wet) { mesh.current.setMatrixAt(i, HIDE); return }
        e.set(roll, yaw, 0)
        q.setFromEuler(e)
        pos.set(px, py, pz)
        scl.set(s, s, s)
        m.compose(pos, q, scl)
        mesh.current.setMatrixAt(i, m)
      }

      place(boats, x, it.y + 0.28 + bobBoat, z, heading, it.scale, bobBoat * 0.5)
      // Body rides in the water, not under it: most of the torso stays visible.
      const bullY = it.y + 0.12 + bobBull
      place(bodies, bx, bullY, bz, heading, it.scale * it.bull)
      place(heads, bx, bullY + Math.sin(t * 1.9 + it.bob) * 0.06, bz, heading, it.scale * it.bull)
      place(trims, bx, bullY + Math.sin(t * 1.9 + it.bob) * 0.06, bz, heading, it.scale * it.bull)

      if (boats.current) boats.current.setColorAt(i, col.set(it.hull))
      if (bodies.current) bodies.current.setColorAt(i, col.set(it.hide))
      if (heads.current) heads.current.setColorAt(i, col.set(it.hide))
    }

    for (const ref of [boats, bodies, heads, trims]) {
      if (!ref.current) continue
      ref.current.instanceMatrix.needsUpdate = true
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
    }
  })

  const n = traffic.length
  return (
    <group>
      <instancedMesh ref={boats} args={[geos.boat, undefined, n]} castShadow receiveShadow frustumCulled={false}>
        {/* Double-sided: an open hull shows its inside from most angles. */}
        <meshStandardMaterial map={timber} roughness={0.88} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={bodies} args={[geos.body, undefined, n]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.62} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[geos.head, undefined, n]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.62} />
      </instancedMesh>
      <instancedMesh ref={trims} args={[geos.trim, undefined, n]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#2a2f33" roughness={0.5} />
      </instancedMesh>
    </group>
  )
}
