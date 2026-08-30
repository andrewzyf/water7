/**
 * End-to-end smoke test: can you actually walk, board a boat, sail it, and step ashore?
 *
 * Run against a built preview (`npm run build && npm run preview`). It drives the real
 * page rather than the modules, so it catches wiring failures — a prop not threaded
 * through, a mode that never flips — that unit-level checks on the world model miss.
 *
 * Note the generous waits: this runs on a software rasteriser at well under 1 fps, so
 * simulated time advances very slowly. Distances travelled will be small; what is being
 * asserted is that the state machine moves, not that it moves fast.
 */
import { chromium } from 'playwright-core'

const URL = process.env.URL || 'http://127.0.0.1:4173/'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage',
  ],
})
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(9000)

const at = () => page.evaluate(() => {
  const s = window.__w7?.player?.()
  if (!s) return null
  return { x: s.x, z: s.z, mode: window.__w7.mode(), speed: s.speed ?? null }
})

/**
 * Wait for a condition on the published state rather than sleeping a fixed time.
 * At well under 1 fps a fixed wait races the frame loop: React flips the mode
 * immediately, but the boat's first frame — which is what actually moves the player
 * onto the water — may be seconds away.
 */
async function waitFor(label, predicate, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await at()
    if (last && predicate(last)) return last
    await page.waitForTimeout(500)
  }
  return last
}

console.log('\n== Scene comes up ==')
const start = await at()
check('player state is published', !!start)
check('no uncaught page errors', errors.length === 0, errors[0] || '')

console.log('\n== Boarding ==')
await page.keyboard.press('KeyE')
// The boat has taken over once it starts publishing a speed.
const boarded = await waitFor('boarded', (s) => s.mode === 'boat' && s.speed !== null)
check('E boards a boat from the quay', boarded?.mode === 'boat')
check('boat launches onto water, not the spawn point',
  boarded && Math.hypot(boarded.x - start.x, boarded.z - start.z) > 1,
  boarded ? `moved ${Math.hypot(boarded.x - start.x, boarded.z - start.z).toFixed(1)} m` : '')

console.log('\n== Throttle ==')
await page.keyboard.down('KeyW')
const moving = await waitFor('under way', (s) => (s.speed ?? 0) > 0.5)
await page.keyboard.up('KeyW')
check('throttle builds speed', (moving?.speed ?? 0) > 0.5, `${moving?.speed?.toFixed(2)} m/s`)

console.log('\n== Stepping ashore ==')
await page.keyboard.press('KeyE')
const ashore = await waitFor('ashore', (s) => s.mode === 'foot' && s.speed === null)
check('E puts the player back on foot', ashore?.mode === 'foot')

console.log('\n== Overlays ==')
await page.keyboard.press('KeyM')
await page.waitForTimeout(1500)
check('M opens the layout map',
  await page.evaluate(() => document.body.innerText.includes('layout plan')))
await page.keyboard.press('KeyM')

await browser.close()
console.log(`\n${failures === 0 ? 'SMOKE TEST PASSED' : failures + ' FAILURE(S)'}\n`)
process.exit(failures === 0 ? 0 : 1)
