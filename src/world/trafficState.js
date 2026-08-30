/**
 * Live positions of the Yagara teams working the canals.
 *
 * Shared as plain module state rather than through React, because it is written every
 * frame by the traffic renderer and read every frame by the boarding search — routing
 * that through props would re-render the scene sixty times a second to move some boats.
 *
 * `hidden` holds the index of a team the player has mounted, so the automated one stops
 * being drawn while they are riding it.
 */
export const trafficState = {
  /** One entry per team: { x, z, y, tier }. Mutated in place. */
  teams: [],
  hidden: new Set(),
}

/** Nearest team to a point that is not already being ridden. */
export function nearestTeam(x, z, maxRadius = 20) {
  let best = null
  let bestD = maxRadius * maxRadius
  for (let i = 0; i < trafficState.teams.length; i++) {
    if (trafficState.hidden.has(i)) continue
    const t = trafficState.teams[i]
    if (!t) continue
    const d = (t.x - x) ** 2 + (t.z - z) ** 2
    if (d < bestD) { bestD = d; best = { index: i, ...t } }
  }
  return best
}
