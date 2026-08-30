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
    // Threaded through the walker's current height, as the controller does. Without it
    // the query snaps onto whatever structure is highest overhead — the fountain's
    // balcony, thirty metres up — rather than the ground being walked on.
    const s = sampleSurface(x, z, prev?.y ?? null)
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
      const s = sampleSurface(x, z, prev?.y ?? null)
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
  // Keyed by height band as well as position: the island is multi-level now — bridges,
  // stair treads, the fountain's galleries — and a cell reachable at two heights has to
  // be explored at both, or the first (lower) visit locks out the climb.
  const LEVEL = 4
  const key = (i, j, y) => `${i},${j},${Math.round(y / LEVEL)}`
  const [sx, sz] = polar(SPAWN.radius, SPAWN.bearing)
  const startY = sampleSurface(sx, sz).y
  const start = [Math.round(sx / CELL), Math.round(sz / CELL), startY]
  const seen = new Set([key(...start)])
  const queue = [start]
  const reached = [{ i: start[0], j: start[1], y: startY }]

  while (queue.length) {
    const [i, j, y] = queue.pop()
    const x = i * CELL
    const z = j * CELL
    const from = { x, z, y }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di
      const nj = j + dj
      const nx = ni * CELL
      const nz = nj * CELL
      if (Math.hypot(nx, nz) > ISLAND_RADIUS + 30) continue
      if (blocked(nx, nz, colliders, 0.45)) continue
      if (sampleSurface(nx, nz, from.y).water) continue
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
      const kk = key(ni, nj, cur.y)
      if (seen.has(kk)) continue
      seen.add(kk)
      reached.push({ i: ni, j: nj, y: cur.y })
      queue.push([ni, nj, cur.y])
    }
  }

  const footprintCells = new Set(reached.map((c) => `${c.i},${c.j}`))
  check('a large area is reachable on foot', footprintCells.size > 20000,
    `${footprintCells.size} cells (${(footprintCells.size * CELL * CELL / 10000).toFixed(1)} ha)`)

  // Each landmark should have reachable ground near it.
  const near = (bearing, radius, tol = 26) => {
    const [lx, lz] = polar(radius, bearing)
    return reached.some((c) => Math.hypot(c.i * CELL - lx, c.j * CELL - lz) < tol)
  }
  check('the summit plaza is reachable', near(0, 20, 40))
  check('the Market Plaza is reachable', near(LANDMARKS.marketPlaza.bearing, LANDMARKS.marketPlaza.radius))
  check('Galley-La HQ is reachable', near(LANDMARKS.galleyLaHQ.bearing, LANDMARKS.galleyLaHQ.radius + 45))
  check('Blue Station is reachable', near(LANDMARKS.blueStation.bearing, LANDMARKS.blueStation.radius - 30))
  for (const d of DOCKS) {
    check(`Dock ${d.n} quay is reachable`, near(d.bearing, d.radius - 26, 30))
  }

  const ys = reached.map((c) => c.y)
  check('reachable ground spans every terrace',
    Math.max(...ys) - Math.min(...ys) > 80,
    `${Math.min(...ys).toFixed(0)} m to ${Math.max(...ys).toFixed(0)} m`)

  // Not just "somewhere high" — the fountain's upper balcony has to be walkable to from
  // the spawn point, which is the whole point of building a route up it.
  const { FOUNTAIN: FN } = await import('../src/world/fountainNav.js')
  const balconyY = FN.baseY + FN.gallery2.y
  check('the fountain balcony is reachable from spawn',
    reached.some((c) => Math.abs(c.y - balconyY) < 2),
    `highest reached ${Math.max(...ys).toFixed(0)} m, balcony ${balconyY.toFixed(0)} m`)
}

// The hand-placed landmarks are meshes no generator knows about, so nothing would
// notice if they had no collision — which for a long time they did not, and you could
// walk straight through Galley-La HQ.
// The route up the fountain is laid out in disjoint radial bands so a height field can
// hold it; that only works if each band really is walkable end to end.
console.log('\n== You can climb the Great Fountain ==')
{
  const { FOUNTAIN } = await import('../src/world/fountainNav.js')
  const abs = (y) => FOUNTAIN.baseY + y

  const walk = (radius, fromDeg, toDeg, label) => {
    let prev = null
    let ok = true
    let stuck = null
    const dir = Math.sign(toDeg - fromDeg)
    for (let d = fromDeg; dir > 0 ? d <= toDeg : d >= toDeg; d += dir * 0.4) {
      const [x, z] = polar(radius, (d + 360) % 360)
      const s = sampleSurface(x, z, prev?.y ?? null)
      if (prev && canStand(prev, { x, z }) === null) { ok = false; stuck = d; break }
      prev = { x, z, y: s.y }
    }
    check(label, ok, ok ? `ends at ${prev.y.toFixed(1)} m` : `blocked at ${stuck?.toFixed(0)}deg`)
    return prev
  }

  const midA = (FOUNTAIN.stairA.rIn + FOUNTAIN.stairA.rOut) / 2
  const topA = walk(midA, 360, 300, 'stair A climbs from the plaza to gallery 1')
  check('stair A reaches gallery 1', Math.abs((topA?.y ?? 0) - abs(FOUNTAIN.gallery1.y)) < 1.0)

  const midB = (FOUNTAIN.stairB.rIn + FOUNTAIN.stairB.rOut) / 2
  const topB = walk(midB, 300, 360, 'stair B climbs from gallery 1 to gallery 2')
  check('stair B reaches the upper balcony', Math.abs((topB?.y ?? 0) - abs(FOUNTAIN.gallery2.y)) < 1.0)

  // Both galleries must be walkable right round.
  // Each gallery shares its band with the stair that feeds it, so its own stair's
  // sector is skipped rather than a hard-coded one.
  // A stair's sector includes its landing apron, which sits at the lower level.
  const sector = (st) => {
    const bounds = [st.bLo, st.bHi, ...(st.landing ?? [])]
    return [Math.min(...bounds), Math.max(...bounds)]
  }
  for (const [name, g, skip] of [
    ['cornice terrace', FOUNTAIN.gallery1, sector(FOUNTAIN.stairA)],
    ['upper balcony', FOUNTAIN.gallery2, sector(FOUNTAIN.stairB)],
  ]) {
    const r = (g.rIn + g.rOut) / 2
    let ok = true
    for (let d = 0; d < 360; d += 2) {
      if (skip && d >= skip[0] && d <= skip[1]) continue
      const [x, z] = polar(r, d)
      const s = sampleSurface(x, z, abs(g.y))
      if (Math.abs(s.y - abs(g.y)) > 0.6) { ok = false; break }
    }
    check(`${name} is walkable round its ring`, ok)
  }

  // And standing underneath must not teleport you up onto the balcony.
  {
    const r = (FOUNTAIN.gallery2.rIn + FOUNTAIN.gallery2.rOut) / 2
    const [x, z] = polar(r, 120)
    const below = sampleSurface(x, z, FOUNTAIN.baseY)
    check('you can stand beneath the upper balcony', below.y < FOUNTAIN.baseY + 3,
      `surface under it is ${below.y.toFixed(0)} m, balcony is ${abs(FOUNTAIN.gallery2.y).toFixed(0)} m`)
  }
}

// Two boxes whose footprints intersect render as one fused, glitched mass. The block
// placement mostly avoids it, but the angular jitter and adjacent rings can still
// collide, so it is asserted.
console.log('\n== Nothing is fused into anything else ==')
{
  const { footprint, quadsOverlap } = await import('../src/world/overlap.js')
  const buildings = generateCity()
  const props = generateProps(buildings)
  const quads = buildings.map((b) => footprint(b))

  let pairs = 0
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      if (Math.hypot(buildings[i].x - buildings[j].x, buildings[i].z - buildings[j].z) > 34) continue
      if (quadsOverlap(quads[i], quads[j])) pairs++
    }
  }
  check('no two buildings overlap', pairs === 0, `${pairs} overlapping pairs of ${buildings.length}`)

  let inside = 0
  let counted = 0
  for (const kind of ['crates', 'barrels', 'stallTops', 'lanternPosts', 'bollards']) {
    for (const it of props[kind]) {
      counted++
      const [x, , z] = it.position
      const q = [[x - 1, z - 1], [x + 1, z - 1], [x + 1, z + 1], [x - 1, z + 1]]
      for (let i = 0; i < buildings.length; i++) {
        if (Math.hypot(buildings[i].x - x, buildings[i].z - z) > 25) continue
        if (quadsOverlap(q, quads[i])) { inside++; break }
      }
    }
  }
  check('no street prop sits inside a building', inside === 0, `${inside} of ${counted}`)
}

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
