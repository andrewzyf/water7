/**
 * Getting into and out of the boat.
 *
 * Both directions are the same search: step outward in a widening ring from where you
 * are and take the first spot of the kind you want. It keeps boarding forgiving — you
 * do not have to find an exact marked jetty, just be near the water — while making it
 * impossible to end up standing in a canal or moored on a street.
 */
import { isWaterAt } from './terrain.js'
import { sampleSurface, canStand } from './nav.js'
import { nearestTeam } from './trafficState.js'

const RINGS = 16
const SPOKES = 24

function search(from, maxRadius, accept) {
  for (let i = 1; i <= RINGS; i++) {
    const r = (maxRadius * i) / RINGS
    for (let k = 0; k < SPOKES; k++) {
      const a = (k / SPOKES) * Math.PI * 2 + i * 0.31
      const x = from.x + Math.cos(a) * r
      const z = from.z + Math.sin(a) * r
      const hit = accept(x, z)
      if (hit) return hit
    }
  }
  return null
}

/**
 * How far open water continues from a point in a given direction.
 * Used to work out which way a canal runs, so a boat is launched along it.
 */
function waterReach(x, z, heading, limit = 60) {
  for (let d = 2; d <= limit; d += 2) {
    if (!isWaterAt(x + Math.sin(heading) * d, z + Math.cos(heading) * d)) return d
  }
  return limit
}

/** Nearest navigable water, for boarding. */
export function findBoardingSpot(from, maxRadius = 24) {
  return search(from, maxRadius, (x, z) => {
    if (!isWaterAt(x, z)) return null
    // Give the hull room, so it does not spawn wedged against a quay wall.
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
      if (!isWaterAt(x + dx, z + dz)) return null
    }
    // Launch along the channel, not across it: pointing at the far bank of a 20 m canal
    // means the boat stalls against stone within a second of setting off.
    let heading = 0
    let best = -1
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const reach = waterReach(x, z, a)
      if (reach > best) { best = reach; heading = a }
    }
    return { x, z, heading }
  })
}

/** Nearest dry ground you could stand on, for stepping ashore. */
export function findLandingSpot(from, maxRadius = 18) {
  return search(from, maxRadius, (x, z) => {
    const s = sampleSurface(x, z)
    if (s.water) return null
    // Must be a place the walking rules would actually let you stand.
    if (!canStand({ x: from.x, z: from.z, y: s.y }, { x, z })) return null
    return { x, z, y: s.y }
  })
}

/**
 * The nearest Yagara Bull you could climb onto.
 *
 * Yagara are Water 7's canal traffic, and riding one is the most characteristic way to
 * get about the city — so mounting takes priority over taking a boat when both are in
 * reach.
 */
export function findRideableYagara(from, maxRadius = 22) {
  const team = nearestTeam(from.x, from.z, maxRadius)
  if (!team) return null
  if (!isWaterAt(team.x, team.z)) return null
  // Point along the channel, as with a boat: across it means an immediate stall.
  let heading = 0
  let best = -1
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2
    const reach = waterReach(team.x, team.z, a)
    if (reach > best) { best = reach; heading = a }
  }
  return { x: team.x, z: team.z, heading, teamIndex: team.index }
}
