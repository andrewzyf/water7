/**
 * Layout invariants.
 *
 * The island's navigability is emergent — it falls out of the height field rather than
 * being hand-placed — so it needs checking rather than assuming. This asserts the
 * things that would silently break exploration: a ramp cut by a canal, a dock basin
 * overlapping a canal or a ramp, a bridge that does not actually span water, or a
 * terrace you cannot climb.
 */
import {
  DOCKS, RADIAL_CANALS, RAMP_BEARINGS, RAMP_HALF_WIDTH, TIERS, DEG, polar,
  RING_CANALS, ISLAND_RADIUS,
} from '../src/world/config.js'
import { canalBearingAt, ringRadiusAt, terraceOuterAt } from '../src/world/shape.js'
import { angDelta, dockMask, canalMask, heightAt } from '../src/world/terrain.js'
import { DOCK_BASIN } from '../src/world/terrain.js'
import { BRIDGES } from '../src/world/bridges.js'
import { sampleSurface, canStand } from '../src/world/nav.js'

let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
}

// Ring canals are *meant* to cross the ramps — each crossing carries a bridge. A
// radial canal running down a ramp, however, would sever the route with no crossing
// to put a bridge on, so only those are disqualifying.
console.log('\n== No radial canal runs down a ramp ==')
for (const rb of RAMP_BEARINGS) {
  let worst = Infinity
  for (let r = 60; r < ISLAND_RADIUS; r += 2) {
    for (const ch of RADIAL_CANALS.channels) {
      if (r <= ch.inner) continue
      const arc = angDelta(rb, canalBearingAt(ch, r)) * DEG * r
      if (arc < ch.halfWidth + 6) worst = Math.min(worst, r)
    }
  }
  check(`ramp @ ${rb}deg clear of radial canals`, worst === Infinity,
    worst === Infinity ? '' : `canal crosses at r=${worst.toFixed(0)}`)
}

console.log('\n== Every ramp is actually climbable end to end ==')
for (const rb of RAMP_BEARINGS) {
  let ok = true
  let blockedAt = null
  let prev = null
  for (let r = ISLAND_RADIUS - 20; r > 20; r -= 0.5) {
    const [x, z] = polar(r, rb)
    const s = sampleSurface(x, z)
    if (prev && canStand(prev, { x, z }) === null) { ok = false; blockedAt = r; break }
    prev = { x, z, y: s.y }
  }
  check(`ramp @ ${rb}deg walkable shore -> summit`, ok,
    ok ? '' : `blocked at r=${blockedAt?.toFixed(0)}`)
}

console.log('\n== Dock basins clear of canals and ramps ==')
for (const d of DOCKS) {
  const halfDeg = (d.width / 2 / d.radius) / DEG
  // Radial canals must not cut the basin; the dock canal running past its mouth is
  // the intended arrangement, so ring canals are checked separately below.
  let canalHit = false
  for (let r = DOCK_BASIN.innerR; r <= DOCK_BASIN.outerR; r += 3) {
    for (let a = -halfDeg; a <= halfDeg; a += 0.6) {
      const b = (d.bearing + a + 360) % 360
      for (const ch of RADIAL_CANALS.channels) {
        if (r <= ch.inner) continue
        if (angDelta(b, canalBearingAt(ch, r)) * DEG * r < ch.halfWidth) canalHit = true
      }
    }
  }
  const rampGap = Math.min(...RAMP_BEARINGS.map((b) => angDelta(d.bearing, b)))
  check(`Dock ${d.n} (${d.bearing}deg) clear of canals`, !canalHit)
  check(`Dock ${d.n} clear of ramps`, rampGap > halfDeg,
    `nearest ramp ${rampGap.toFixed(1)}deg vs half-arc ${halfDeg.toFixed(1)}deg`)
}

console.log('\n== Every bridge spans real water and is walkable ==')
let badSpan = 0
let badWalk = 0
for (const br of BRIDGES) {
  const [cx, cz] = polar(br.radius, br.bearing)
  const mid = sampleSurface(cx, cz)
  if (!mid.onBridge) badWalk++
  // The ground under the crown should be a canal bed, i.e. well below the street.
  if (heightAt(cx, cz) > br.y - 2) badSpan++
}
check(`all ${BRIDGES.length} bridge crowns are standable`, badWalk === 0, `${badWalk} bad`)
check('all bridges actually cross water', badSpan === 0, `${badSpan} span dry ground`)

console.log('\n== Terraces are separated by unclimbable walls away from ramps ==')
for (let i = 0; i < TIERS.length - 1; i++) {
  const t = TIERS[i]
  let leaks = 0
  for (let b = 0; b < 360; b += 1) {
    const nearRamp = RAMP_BEARINGS.some((rb) => angDelta(b, rb) < RAMP_HALF_WIDTH + 3)
    if (nearRamp) continue
    const edge = terraceOuterAt(t, b)
    let prev = null
    let climbed = true
    for (let r = edge + 14; r > edge - 14; r -= 0.5) {
      const [x, z] = polar(r, b)
      const s = sampleSurface(x, z)
      if (prev && canStand(prev, { x, z }) === null) { climbed = false; break }
      prev = { x, z, y: s.y }
    }
    if (climbed) leaks++
  }
  check(`${t.name} wall holds (non-ramp bearings)`, leaks === 0, `${leaks}/360 bearings climbable`)
}

console.log('\n== The dock canal threads between the basins and the shore ==')
{
  const rc = RING_CANALS.find((c) => c.tier === 0)
  let minGapToBasin = Infinity
  let minGapToShore = Infinity
  for (let b = 0; b < 360; b += 1) {
    const r = ringRadiusAt(rc, b)
    minGapToBasin = Math.min(minGapToBasin, (r - rc.halfWidth) - DOCK_BASIN.outerR)
    minGapToShore = Math.min(minGapToShore, terraceOuterAt(TIERS[TIERS.length - 1], b) - (r + rc.halfWidth))
  }
  check('dock canal stays outside the dock basins', minGapToBasin > 0,
    `min gap ${minGapToBasin.toFixed(1)} m`)
  check('dock canal stays inside the shoreline', minGapToShore > 0,
    `min gap ${minGapToShore.toFixed(1)} m`)
}

console.log('\n== Spawn point is on dry, standable ground ==')
{
  const { SPAWN } = await import('../src/world/config.js')
  const [x, z] = polar(SPAWN.radius, SPAWN.bearing)
  const s = sampleSurface(x, z)
  check('spawn is dry land', !s.water, `y=${s.y.toFixed(1)}`)
}

console.log(`\n${failures === 0 ? 'ALL LAYOUT INVARIANTS HOLD' : failures + ' FAILURE(S)'}\n`)
process.exit(failures === 0 ? 0 : 1)
