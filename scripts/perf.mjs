import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage']})
const p = await b.newPage({ viewport:{width:1280,height:720} })
p.on('pageerror', e=>console.log('EXC:',e.message))
await p.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'}); await p.waitForTimeout(8000)
const measure = async (label) => {
  const fps = await p.evaluate(() => new Promise(res => {
    let n=0; const t0=performance.now()
    const tick=()=>{n++; if(performance.now()-t0<5000) requestAnimationFrame(tick); else res(n/((performance.now()-t0)/1000))}
    requestAnimationFrame(tick)
  }))
  console.log(label.padEnd(9), fps.toFixed(2), 'fps')
}
await measure('high')
await p.keyboard.press('KeyQ'); await p.waitForTimeout(4000); await measure('medium')
await p.keyboard.press('KeyQ'); await p.waitForTimeout(4000); await measure('low')
await b.close()
