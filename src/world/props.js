/**
 * Street life.
 *
 * Architecture alone reads as a model; what makes a city look inhabited is the small
 * stuff at eye level — lamps along the quay, bollards where boats tie up, laundry strung
 * across the gaps between houses, market awnings, stacked crates by the yards, and hulls
 * moored in the canals. All of it is placed off the same canal centrelines and building
 * list the rest of the world is built from, so nothing lands in the water by accident.
 */
import {
  TIERS, RADIAL_CANALS, RING_CANALS, DEG, ISLAND_RADIUS, LANDMARKS, polar, tierById,
} from './config.js'
import { ringRadiusAt, canalBearingAt, tierRangeAt } from './shape.js'
import { isWaterAt, heightAt } from './terrain.js'
import { makeRng, rand, pick } from './rng.js'
import { PALETTE } from './palette.js'

const unit = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG)]
const perp = (deg) => [-Math.sin(deg * DEG), Math.cos(deg * DEG)]

const AWNING_COLORS = ['#c4543f', '#3f7a86', '#c99a3c', '#6b8f5a', '#a24d6e']
const CLOTH_COLORS = ['#e8e2d2', '#d8e6ea', '#e6d5c0', '#cfd9c6', '#eae0e6', '#dcd2e2']

/** Walk every canal bank, emitting positions at a given spacing. */
function walkBanks(spacingM, cb) {
  for (const tier of TIERS) {
    for (const ch of RADIAL_CANALS.channels) {
      const [inner, outer] = tierRangeAt(tier, ch.bearing)
      const r0 = Math.max(inner, ch.inner)
      const r1 = Math.min(outer, ISLAND_RADIUS)
      if (r1 - r0 < 14) continue
      const steps = Math.max(2, Math.floor((r1 - r0) / spacingM))
      for (let i = 1; i < steps; i++) {
        const r = r0 + ((r1 - r0) * i) / steps
        const deg = canalBearingAt(ch, r)
        const d = unit(deg)
        const p = perp(deg)
        for (const side of [-1, 1]) {
          const o = side * (ch.halfWidth + 2.8)
          cb({
            x: r * d[0] + p[0] * o,
            z: r * d[1] + p[1] * o,
            y: tier.y,
            // Yaw facing the water.
            yaw: Math.atan2(-p[0] * side, -p[1] * side),
            tier: tier.id,
          })
        }
      }
    }
    for (const rc of RING_CANALS) {
      if (rc.tier !== tier.id) continue
      const circumference = 2 * Math.PI * rc.radius
      const steps = Math.max(8, Math.floor(circumference / spacingM))
      for (let i = 0; i < steps; i++) {
        const deg = (i / steps) * 360
        const r = ringRadiusAt(rc, deg)
        const d = unit(deg)
        for (const side of [-1, 1]) {
          const rr = r + side * (rc.halfWidth + 2.8)
          cb({
            x: rr * d[0],
            z: rr * d[1],
            y: tier.y,
            yaw: Math.atan2(-d[0] * side, -d[1] * side),
            tier: tier.id,
          })
        }
      }
    }
  }
}

export function generateProps(buildings, seed = 424242) {
  const rng = makeRng(seed)

  const lanternPosts = []
  const lanternHeads = []
  const lanternCaps = []
  const bollards = []
  const crates = []
  const barrels = []
  const stallTops = []
  const stallPosts = []
  const lines = []      // laundry lines: {a:[x,y,z], b:[x,y,z]}
  const cloths = []
  const boats = []

  // --- quayside furniture ---
  let n = 0
  walkBanks(11, (p) => {
    n++
    if (isWaterAt(p.x, p.z)) return
    // Alternate: a lamp, then a couple of bollards, then a lamp.
    if (n % 3 === 0) {
      lanternPosts.push({
        position: [p.x, p.y + 2.1, p.z], rotation: p.yaw,
        scale: [0.28, 4.2, 0.28], color: '#3f4650',
      })
      lanternHeads.push({
        position: [p.x, p.y + 4.35, p.z], rotation: p.yaw,
        scale: [0.52, 0.72, 0.52], color: '#ffd89a',
      })
      lanternCaps.push({
        position: [p.x, p.y + 4.82, p.z], rotation: p.yaw,
        scale: [0.72, 0.22, 0.72], color: '#39404a',
      })
    } else {
      bollards.push({
        position: [p.x, p.y + 0.5, p.z], rotation: p.yaw,
        scale: [0.72, 1.0, 0.72], color: '#8d8578',
      })
    }
  })

  // --- moored hulls in the navigable canals ---
  // Only the tier-0 dock canal and the tier-1 grand canal are wide enough.
  for (const rc of RING_CANALS) {
    const tier = tierById(rc.tier)
    const waterY = rc.tier === 0 ? 0 : tier.y - 3.5
    const count = rc.tier === 0 ? 26 : 20
    for (let i = 0; i < count; i++) {
      const deg = rand(rng, 0, 360)
      const r = ringRadiusAt(rc, deg) + rand(rng, -1, 1) * (rc.halfWidth - 2.6)
      const d = unit(deg)
      const x = r * d[0]
      const z = r * d[1]
      // Only where there is actually water: the ring wobbles, and a boat parked on the
      // quay is worse than one boat fewer.
      if (!isWaterAt(x, z)) continue
      boats.push({
        position: [x, waterY + 0.3, z],
        rotation: -deg * DEG + rand(rng, -0.35, 0.35) + Math.PI / 2,
        scale: rand(rng, 0.85, 1.35),
        color: pick(rng, ['#7a5c3a', '#6b6f78', '#8a5340', '#5f6b52']),
        awning: rng() < 0.45 ? pick(rng, AWNING_COLORS) : null,
      })
    }
  }

  // --- market stalls on the plaza ---
  {
    const plaza = LANDMARKS.marketPlaza
    const [px, pz] = polar(plaza.radius, plaza.bearing)
    const y = tierById(1).y
    for (let i = 0; i < 34; i++) {
      const a = rand(rng, 0, Math.PI * 2)
      const rad = Math.sqrt(rng()) * 30
      const x = px + Math.cos(a) * rad
      const z = pz + Math.sin(a) * rad
      if (isWaterAt(x, z)) continue
      const gy = heightAt(x, z)
      if (Math.abs(gy - y) > 3) continue
      const yaw = rand(rng, 0, Math.PI * 2)
      const w = rand(rng, 3.2, 4.6)
      stallTops.push({
        position: [x, gy + 2.9, z], rotation: yaw,
        scale: [w, 0.34, w * 0.72], color: pick(rng, AWNING_COLORS),
      })
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          stallPosts.push({
            position: [
              x + (Math.cos(yaw) * sx * w * 0.44) + (Math.sin(yaw) * sz * w * 0.32),
              gy + 1.45,
              z - (Math.sin(yaw) * sx * w * 0.44) + (Math.cos(yaw) * sz * w * 0.32),
            ],
            rotation: yaw, scale: [0.16, 2.9, 0.16], color: PALETTE.timberDark,
          })
        }
      }
      // Goods on the counter.
      crates.push({
        position: [x, gy + 0.7, z], rotation: yaw,
        scale: [w * 0.7, 1.4, w * 0.5], color: pick(rng, ['#8a6a45', '#96795a', '#7d6340']),
      })
    }
  }

  // --- crates and barrels around the dock ring ---
  for (let i = 0; i < 160; i++) {
    const bearing = rand(rng, 0, 360)
    const r = rand(rng, 316, 396)
    const [x, z] = polar(r, bearing)
    if (isWaterAt(x, z)) continue
    const gy = heightAt(x, z)
    if (gy < 1 || gy > 8) continue
    if (rng() < 0.5) {
      crates.push({
        position: [x, gy + 0.75, z], rotation: rand(rng, 0, Math.PI),
        scale: [rand(rng, 1.2, 2.0), 1.5, rand(rng, 1.2, 2.0)],
        color: pick(rng, ['#8a6a45', '#96795a', '#6f5738']),
      })
    } else {
      barrels.push({
        position: [x, gy + 0.8, z], rotation: rand(rng, 0, Math.PI),
        scale: [0.85, 1.6, 0.85], color: pick(rng, ['#7d5a36', '#6b6f78']),
      })
    }
  }

  // --- laundry strung between neighbouring houses ---
  // Only across genuinely narrow gaps, which is where it happens in the reference art.
  const byCell = new Map()
  for (const b of buildings) {
    const key = `${Math.round(b.x / 40)},${Math.round(b.z / 40)}`
    if (!byCell.has(key)) byCell.set(key, [])
    byCell.get(key).push(b)
  }
  for (const group of byCell.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        const gap = Math.hypot(a.x - b.x, a.z - b.z)
        if (gap < 12 || gap > 21) continue
        if (rng() > 0.34) continue
        const ha = a.y + a.height * rand(rng, 0.55, 0.75)
        const hb = b.y + b.height * rand(rng, 0.55, 0.75)
        lines.push({ a: [a.x, ha, a.z], b: [b.x, hb, b.z] })
        const items = 3 + Math.floor(rng() * 4)
        for (let k = 0; k < items; k++) {
          const t = (k + 0.8) / (items + 0.6)
          const x = a.x + (b.x - a.x) * t
          const z = a.z + (b.z - a.z) * t
          // Sag, deepest mid-span.
          const y = ha + (hb - ha) * t - Math.sin(Math.PI * t) * 1.15
          cloths.push({
            position: [x, y - 0.85, z],
            rotation: Math.atan2(b.x - a.x, b.z - a.z),
            scale: [rand(rng, 0.9, 1.6), rand(rng, 1.2, 2.0), 0.06],
            color: pick(rng, CLOTH_COLORS),
          })
        }
      }
    }
  }

  return {
    lanternPosts, lanternHeads, lanternCaps, bollards, crates, barrels,
    stallTops, stallPosts, lines, cloths, boats,
  }
}
