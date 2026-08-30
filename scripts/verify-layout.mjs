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
  RING_CANALS, ISLAND_RADIUS, SPAWN, LANDMARKS,
} from '../src/world/config.js'
import { canalBearingAt, ringRadiusAt, terraceOuterAt } from '../src/world/shape.js'
import { angDelta, dockMask, canalMask, heightAt } from '../src/world/terrain.js'
import { DOCK_BASIN } from '../src/world/terrain.js'
import { BRIDGES } from '../src/world/bridges.js'
import { buildCanals, buildSea, meanNormalY } from '../src/world/water/canalGeometry.js'
import { generateCity, buildColliders } from '../src/world/city.js'
import { generateProps } from '../src/world/props.js'
import { landmarkColliders, propColliders, blocked } from '../src/world/colliders.js'
import { MOVE_SUBSTEP } from '../src/world/nav.js'
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

// Walked at the mover's own substep. Sampling coarser than that skips whole stair
// treads and reports two risers as one impossible step.
console.log('\n== Every ramp is actually climbable end to end ==')
for (const rb of RAMP_BEARINGS) {
  let ok = true
  let blockedAt = null
  let prev = null
  for (let r = ISLAND_RADIUS - 20; r > 20; r -= MOVE_SUBSTEP) {
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

// A water surface wound face-down is back-face culled, so the canal simply looks
// drained. That has slipped through twice; it is asserted now.
console.log('\n== Water surfaces face upward ==')
{
  const canals = meanNormalY(buildCanals())
  const sea = meanNormalY(buildSea())
  check('canal network faces up', canals > 0.9, `mean normal.y = ${canals.toFixed(3)}`)
  check('sea faces up', sea > 0.9, `mean normal.y = ${sea.toFixed(3)}`)
}

console.log('\n== Spawn point is on dry, standable ground ==')
{
  const { SPAWN } = await import('../src/world/config.js')
  const [x, z] = polar(SPAWN.radius, SPAWN.bearing)
  const s = sampleSurface(x, z)
  check('spawn is dry land', !s.water, `y=${s.y.toFixed(1)}`)
}

/**
 * Reachability.
 *
 * The single most important property of an exploration game is that you can get to the
 * places in it, and that is emergent here rather than authored: it falls out of the
 * slope limit, the water test and the collider set. So it is flood-filled with the
 * mover's own rules, from the spawn point, and checked against the landmarks.
 */
console.log('\n== You can walk where you want ==')
{
  const buildings = generateCity()
  const props = generateProps(buildings)
  const colliders = [
    ...buildColliders(buildings),
    ...landmarkColliders(),
    ...propColliders(props),
  ]

  const CELL = 3
  const key = (i, j) => `${i},${j}`
  const walkable = (x, z) => {
    const s = sampleSurface(x, z)
    return !s.water && !blocked(x, z, colliders, 0.45)
  }

  const [sx, sz] = polar(SPAWN.radius, SPAWN.bearing)
  const start = [Math.round(sx / CELL), Math.round(sz / CELL)]
  const seen = new Set([key(...start)])
  const queue = [start]
  const heights = new Map()

  while (queue.length) {
    const [i, j] = queue.pop()
    const x = i * CELL
    const z = j * CELL
    const from = { x, z, y: sampleSurface(x, z).y }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di
      const nj = j + dj
      const kk = key(ni, nj)
      if (seen.has(kk)) continue
      const nx = ni * CELL
      const nz = nj * CELL
      if (Math.hypot(nx, nz) > ISLAND_RADIUS + 30) continue
      if (!walkable(nx, nz)) continue
      // Walk the gap in substeps, exactly as the controller does.
      let ok = true
      let cur = from
      const steps = Math.ceil(CELL / MOVE_SUBSTEP)
      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        const px = x + (nx - x) * t
        const pz = z + (nz - z) * t
        if (blocked(px, pz, colliders, 0.45)) { ok = false; break }
        const surf = canStand(cur, { x: px, z: pz })
        if (!surf) { ok = false; break }
        cur = { x: px, z: pz, y: surf.y }
      }
      if (!ok) continue
      seen.add(kk)
      heights.set(kk, cur.y)
      queue.push([ni, nj])
    }
  }

  check('a large area is reachable on foot', seen.size > 4000, `${seen.size} cells (${(seen.size * CELL * CELL / 10000).toFixed(1)} ha)`)

  // Each landmark should have reachable ground near it.
  const near = (bearing, radius, tol = 26) => {
    const [lx, lz] = polar(radius, bearing)
    for (const k of seen) {
      const [i, j] = k.split(',').map(Number)
      if (Math.hypot(i * CELL - lx, j * CELL - lz) < tol) return true
    }
    return false
  }
  check('the summit plaza is reachable', near(0, 20, 40))
  check('the Market Plaza is reachable', near(LANDMARKS.marketPlaza.bearing, LANDMARKS.marketPlaza.radius))
  check('Galley-La HQ is reachable', near(LANDMARKS.galleyLaHQ.bearing, LANDMARKS.galleyLaHQ.radius + 45))
  check('Blue Station is reachable', near(LANDMARKS.blueStation.bearing, LANDMARKS.blueStation.radius - 30))
  for (const d of DOCKS) {
    check(`Dock ${d.n} quay is reachable`, near(d.bearing, d.radius - 26, 30))
  }

  const ys = [...heights.values()]
  check('reachable ground spans every terrace',
    Math.max(...ys) - Math.min(...ys) > 80,
    `${Math.min(...ys).toFixed(0)} m to ${Math.max(...ys).toFixed(0)} m`)
}

// The hand-placed landmarks are meshes no generator knows about, so nothing would
// notice if they had no collision — which for a long time they did not, and you could
// walk straight through Galley-La HQ.
console.log('\n== The landmarks are solid ==')
{
  const solid = landmarkColliders()
  const at = (bearing, radius) => {
    const [x, z] = polar(radius, bearing)
    return blocked(x, z, solid, 0.45)
  }
  check('Great Fountain is solid', at(0, 8))
  // The HQ is two buildings with a forecourt between them, so both are checked and the
  // courtyard is expected to stay open.
  const hq = LANDMARKS.galleyLaHQ
  check('Galley-La timber hall is solid', at(hq.bearing, hq.radius + 12))
  check('Galley-La stone block is solid', at(hq.bearing, hq.radius - 16))
  check('the HQ forecourt is walkable', !at(hq.bearing, hq.radius + 34))
  check('Blue Station concourse is solid', at(LANDMARKS.blueStation.bearing, LANDMARKS.blueStation.radius))
  check('Franky House is solid', at(52, 458))
  // Dock gates block either side of the arch, but you can walk in through the opening.
  const d = DOCKS[0]
  const halfArc = (d.width * 0.42 / (DOCK_BASIN.innerR - 5)) / DEG
  check('dock gate piers are solid', at(d.bearing + halfArc, DOCK_BASIN.innerR - 5))
  check('dock gate arch is walk-through', !at(d.bearing, DOCK_BASIN.innerR - 5))
  // And the summit plaza must not be swallowed by the fountain.
  check('summit plaza is walkable around the fountain', !at(0, 48))
}

console.log(`\n${failures === 0 ? 'ALL LAYOUT INVARIANTS HOLD' : failures + ' FAILURE(S)'}\n`)
process.exit(failures === 0 ? 0 : 1)
