import { chromium } from 'playwright-core'

const URL = process.env.URL || 'http://127.0.0.1:4173/'
const OUT = process.env.OUT || 'shots'

// Camera set-ups used to review the blockout. Each one drives the in-page debug hook.
const VIEWS = JSON.parse(process.env.VIEWS)

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--no-sandbox',
    '--disable-dev-shm-usage', '--ignore-gpu-blocklist',
  ],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(6000)

for (const v of VIEWS) {
  if (v.key) {
    await page.keyboard.press(v.key)
    await page.waitForTimeout(900)
  }
  if (v.cam) {
    await page.evaluate((cam) => window.__w7?.setCamera(cam), v.cam)
    await page.waitForTimeout(1400)
  }
  await page.screenshot({ path: `${OUT}/${v.name}.png` })
  console.log('shot', v.name)
  if (v.key) { await page.keyboard.press(v.key); await page.waitForTimeout(500) }
}
await browser.close()
