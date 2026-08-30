/**
 * Procedural textures, drawn to canvases at load time.
 *
 * Flat colours are what make a blockout look like a blockout. Every surface here gets
 * real grain — mottled plaster, coursed ashlar, ribbed roof tile, plank timber — which
 * does more for perceived sharpness than any amount of extra geometry, and costs no
 * network fetch and no asset pipeline.
 *
 * Textures are built once and cached; each returns a repeating THREE.Texture.
 */
import * as THREE from 'three'

const cache = new Map()

function makeCanvas(size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

function finish(canvas, { repeat = 1, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = aniso
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/** Cheap deterministic value noise, tileable by construction. */
function valueNoise(size, cells, seed = 1) {
  const g = new Float32Array(cells * cells)
  let s = seed
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = 0; i < g.length; i++) g[i] = rnd()

  const at = (x, y) => g[(y % cells) * cells + (x % cells)]
  const out = new Float32Array(size * size)
  const scale = cells / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x * scale
      const fy = y * scale
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const tx = fx - x0
      const ty = fy - y0
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const a = at(x0, y0)
      const b = at(x0 + 1, y0)
      const c = at(x0, y0 + 1)
      const d = at(x0 + 1, y0 + 1)
      out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
    }
  }
  return out
}

/** Sum several octaves of value noise into one 0..1 field. */
function fbm(size, octaves = 4, seed = 1) {
  const out = new Float32Array(size * size)
  let amp = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, 4 << o, seed + o * 37)
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp
    total += amp
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

/** Sun-bleached plaster: mottled, faintly blotched, with a few hairline cracks. */
export function plasterTexture(size = 512) {
  return cached(`plaster${size}`, () => {
    const c = makeCanvas(size)
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(size, size)
    const coarse = fbm(size, 4, 7)
    const fine = fbm(size, 3, 23)
    for (let i = 0; i < size * size; i++) {
      // Mostly white so the instance colour shows through; the texture is grain only.
      const v = 228 + (coarse[i] - 0.5) * 30 + (fine[i] - 0.5) * 16
      const p = i * 4
      img.data[p] = v + 6
      img.data[p + 1] = v
      img.data[p + 2] = v - 6
      img.data[p + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    // Weathering streaks running down the wall.
    ctx.globalAlpha = 0.028
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * size
      ctx.fillStyle = Math.random() < 0.5 ? '#6b5f4e' : '#ffffff'
      ctx.fillRect(x, 0, 1 + Math.random() * 3, size)
    }
    ctx.globalAlpha = 1
    return finish(c, { repeat: 1 })
  })
}

/** Coursed ashlar: staggered blocks with recessed joints. */
export function ashlarTexture(size = 512, courses = 8) {
  return cached(`ashlar${size}x${courses}`, () => {
    const c = makeCanvas(size)
    const ctx = c.getContext('2d')
    const h = size / courses
    ctx.fillStyle = '#9aa0aa'
    ctx.fillRect(0, 0, size, size)

    const grain = fbm(size, 4, 91)
    for (let row = 0; row < courses; row++) {
      const offset = (row % 2) * (size / (courses * 2))
      const blocks = courses
      const w = size / blocks
      for (let b = -1; b < blocks + 1; b++) {
        const x = b * w + offset
        const y = row * h
        const shade = 196 + grain[(row * 37 + b * 13) % (size * size)] * 56
        ctx.fillStyle = `rgb(${shade | 0},${(shade * 1.01) | 0},${(shade * 1.06) | 0})`
        ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3)
        // Top-light bevel on each block.
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(x + 1.5, y + 1.5, w - 3, 1.5)
        ctx.fillStyle = 'rgba(0,0,0,0.16)'
        ctx.fillRect(x + 1.5, y + h - 3, w - 3, 1.5)
      }
    }
    return finish(c)
  })
}

/**
 * Roof tile: the ribbed terracotta run of a barrel vault, banded across the arc.
 * Stripes run along U so they follow the vault's curve when mapped to a cylinder.
 */
export function roofTileTexture(size = 512) {
  return cached(`rooftile${size}`, () => {
    const c = makeCanvas(size)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    const ribs = 34
    const w = size / ribs
    for (let i = 0; i < ribs; i++) {
      const x = i * w
      const g = ctx.createLinearGradient(x, 0, x + w, 0)
      g.addColorStop(0, 'rgba(0,0,0,0.26)')
      g.addColorStop(0.32, 'rgba(255,255,255,0.16)')
      g.addColorStop(0.7, 'rgba(255,255,255,0.05)')
      g.addColorStop(1, 'rgba(0,0,0,0.26)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, w, size)
    }
    // Cross-courses, and a little irregularity so it is not a perfect comb.
    ctx.globalAlpha = 0.10
    for (let y = 0; y < size; y += size / 12) {
      ctx.fillStyle = '#3a1b12'
      ctx.fillRect(0, y, size, 2)
    }
    ctx.globalAlpha = 0.07
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#fff'
      const s = 3 + Math.random() * 14
      ctx.fillRect(Math.random() * size, Math.random() * size, s, s * 0.5)
    }
    ctx.globalAlpha = 1
    return finish(c)
  })
}

/**
 * The gable end of a barrel vault: concentric salmon arcs on terracotta.
 *
 * This is the single most recognisable detail in Water 7's architecture — the banded
 * half-round facing the street — so it is drawn as a real texture rather than implied.
 * Mapped onto the cylinder's end cap, whose UVs are a unit disc centred at (0.5, 0.5).
 */
export function roofArcTexture(size = 256) {
  return cached(`roofarc${size}`, () => {
    const c = makeCanvas(size)
    const ctx = c.getContext('2d')
    // Luminance only — the per-instance roof colour tints this, so the light bands
    // come out as a paler wash of whatever red that particular roof is.
    ctx.fillStyle = '#b4b4b4'
    ctx.fillRect(0, 0, size, size)
    const cx = size / 2
    const cy = size / 2
    const bands = 4
    for (let i = bands; i >= 1; i--) {
      const r = (size / 2) * (i / bands)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = i % 2 ? '#e0bdb1' : '#bb5341'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(70,20,14,0.26)'
      ctx.stroke()
    }
    // Ridge shadow under the eave.
    const g = ctx.createLinearGradient(0, 0, 0, size)
    g.addColorStop(0, 'rgba(255,255,255,0.10)')
    g.addColorStop(1, 'rgba(0,0,0,0.22)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return finish(c, { aniso: 4 })
  })
}

/**
 * A whole window on one transparent quad: pale surround, glazing bars, lavender panes,
 * a stone sill, and shutters folded back against the wall.
 *
 * Drawn rather than modelled because a window built from boxes needs the frame to be
 * hollow — a solid frame box in front of a glass box hides the glass completely — and
 * because one textured quad per opening costs a third of the instances of three boxes.
 */
export function windowTexture(size = 256) {
  return cached(`window${size}`, () => {
    const c = makeCanvas(size)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, size, size)

    const M = size * 0.16          // margin, kept transparent
    const w = size - M * 2
    const h = size * 0.80 - M

    // Shutters, folded back either side of the opening.
    ctx.fillStyle = '#7d8f7e'
    ctx.fillRect(M - size * 0.10, M, size * 0.095, h)
    ctx.fillRect(M + w + size * 0.005, M, size * 0.095, h)
    ctx.fillStyle = 'rgba(0,0,0,0.20)'
    for (let y = M + 4; y < M + h; y += 7) {
      ctx.fillRect(M - size * 0.10, y, size * 0.095, 2)
      ctx.fillRect(M + w + size * 0.005, y, size * 0.095, 2)
    }

    // Reveal / surround.
    ctx.fillStyle = '#f2ebdc'
    ctx.fillRect(M - 7, M - 7, w + 14, h + 14)
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(M - 7, M - 7, w + 14, 4)

    // Glass, darker at the top where the room falls away into shadow.
    const g = ctx.createLinearGradient(0, M, 0, M + h)
    g.addColorStop(0, '#5d5675')
    g.addColorStop(0.42, '#9d94bb')
    g.addColorStop(1, '#c5bcd8')
    ctx.fillStyle = g
    ctx.fillRect(M, M, w, h)

    // A slash of reflected sky across the panes.
    ctx.save()
    ctx.beginPath()
    ctx.rect(M, M, w, h)
    ctx.clip()
    ctx.fillStyle = 'rgba(235,246,252,0.34)'
    ctx.beginPath()
    ctx.moveTo(M - 10, M + h * 0.72)
    ctx.lineTo(M + w * 0.78, M - 10)
    ctx.lineTo(M + w + 10, M - 10)
    ctx.lineTo(M + w + 10, M + h * 0.2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // Glazing bars.
    ctx.fillStyle = '#f4eee1'
    ctx.fillRect(M + w / 2 - 3, M, 6, h)
    ctx.fillRect(M, M + h / 3 - 3, w, 6)
    ctx.fillRect(M, M + (2 * h) / 3 - 3, w, 6)

    // Sill.
    ctx.fillStyle = '#ded2b8'
    ctx.fillRect(M - 12, M + h + 7, w + 24, size * 0.052)
    ctx.fillStyle = 'rgba(0,0,0,0.26)'
    ctx.fillRect(M - 12, M + h + 7 + size * 0.052, w + 24, 4)

    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  })
}

/** Planked timber, for decks, hoardings and Franky House. */
export function timberTexture(size = 512) {
  return cached(`timber${size}`, () => {
    const c = makeCanvas(size)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    const planks = 10
    const h = size / planks
    const grain = fbm(size, 4, 55)
    for (let p = 0; p < planks; p++) {
      const y = p * h
      const base = 190 + ((p * 53) % 40)
      ctx.fillStyle = `rgb(${base},${base - 8},${base - 20})`
      ctx.fillRect(0, y, size, h - 1.5)
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.fillRect(0, y + h - 2.5, size, 2.5)
    }
    // Grain streaks.
    const img = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < size * size; i++) {
      const g = (grain[i] - 0.5) * 40
      img.data[i * 4] += g
      img.data[i * 4 + 1] += g * 0.9
      img.data[i * 4 + 2] += g * 0.7
    }
    ctx.putImageData(img, 0, 0)
    return finish(c)
  })
}

/** Tangent-space normal map of small wind ripples, scrolled by the water shader. */
export function waterNormalTexture(size = 256) {
  return cached(`waternormal${size}`, () => {
    const c = makeCanvas(size)
    const ctx = c.getContext('2d')
    const h = fbm(size, 4, 13)
    const img = ctx.createImageData(size, size)
    const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)]
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2
        const dy = (at(x, y + 1) - at(x, y - 1)) * 2.2
        const nx = -dx
        const ny = -dy
        const nz = 1
        const len = Math.hypot(nx, ny, nz)
        const p = (y * size + x) * 4
        img.data[p] = ((nx / len) * 0.5 + 0.5) * 255
        img.data[p + 1] = ((ny / len) * 0.5 + 0.5) * 255
        img.data[p + 2] = ((nz / len) * 0.5 + 0.5) * 255
        img.data[p + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { srgb: false, aniso: 4 })
  })
}

/** Cobbled quay paving. */
export function cobbleTexture(size = 512) {
  return cached(`cobble${size}`, () => {
    const c = makeCanvas(size)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#cfccc2'
    ctx.fillRect(0, 0, size, size)
    const n = 11
    const w = size / n
    for (let r = 0; r < n; r++) {
      for (let q = -1; q < n + 1; q++) {
        const x = q * w + (r % 2) * w * 0.5
        const y = r * w
        const v = 198 + ((r * 31 + q * 17) % 52)
        ctx.fillStyle = `rgb(${v},${v - 3},${v - 10})`
        ctx.beginPath()
        ctx.roundRect(x + 1, y + 1, w - 2, w - 2, w * 0.28)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 0.08
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#fff'
      ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3)
    }
    ctx.globalAlpha = 1
    return finish(c)
  })
}

function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}
