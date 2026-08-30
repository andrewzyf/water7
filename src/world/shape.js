/**
 * Irregularity.
 *
 * A perfectly concentric island reads as a machine part, not a city — the reference
 * art is Venetian and organic: terraces bulge and pinch, canals meander, and the
 * radial waterways are neither evenly spaced nor all the same size. These functions
 * add that deviation deterministically, and everything that needs to agree about
 * where a terrace edge or a canal actually *is* — terrain, bridges, buildings, water
 * meshes, the map — reads it from here.
 */

import { DEG, TIERS } from './config.js'

/**
 * Smooth periodic deviation as a function of bearing. Three harmonics so the outline
 * bulges and pinches at different scales instead of looking like a plain ellipse.
 */
export function wobble(bearingDeg, seed, amp) {
  const b = bearingDeg * DEG
  const v =
    Math.sin(2 * b + seed) * 0.46 +
    Math.sin(3 * b + seed * 1.7) * 0.34 +
    Math.sin(5 * b + seed * 2.9) * 0.20
  return v * amp
}

/** Actual outer radius of a terrace at a given bearing. */
export function terraceOuterAt(tier, bearingDeg) {
  // The shoreline stays near-circular so the dock basins always have rim to sit in;
  // the inner terraces are free to wander.
  const amp = tier.id === 0 ? 5 : 13
  return tier.outer + wobble(bearingDeg, tier.id * 2.4 + 0.7, amp)
}

/** Actual radius of a ring canal at a given bearing. */
export function ringRadiusAt(rc, bearingDeg) {
  // The dock canal stays tighter: it has to thread between the dock gates and the
  // shoreline without breaking through either.
  const amp = rc.tier === 0 ? 4 : 11
  return rc.radius + wobble(bearingDeg, rc.tier * 3.1 + 1.9, amp)
}

/** A radial canal meanders as it descends, rather than running dead straight. */
export function canalBearingAt(channel, r) {
  return channel.bearing + Math.sin(r / 74 + channel.seed) * channel.meander
}

/**
 * A terrace's real radial extent at a bearing, inner and outer.
 *
 * Anything that has to line up with a terrace *edge* — the water surface that ends in a
 * waterfall, the fall itself — needs the wobbled radius, not the nominal one, or it
 * lands up to 13 m off the step it is supposed to meet.
 */
export function tierRangeAt(tier, bearingDeg) {
  const i = TIERS.indexOf(tier)
  const inner = i > 0 ? terraceOuterAt(TIERS[i - 1], bearingDeg) : 0
  return [inner, terraceOuterAt(tier, bearingDeg)]
}

/** Which terrace a radius falls in at a given bearing, using the real edges. */
export function tierAtBearing(r, bearingDeg) {
  for (const t of TIERS) {
    if (r < terraceOuterAt(t, bearingDeg)) return t
  }
  return null
}
