import { useEffect, useRef } from 'react'
import {
  TIERS, RADIAL_CANALS, RING_CANALS, RAMP_BEARINGS, DOCKS, LANDMARKS,
  ISLAND_RADIUS, polar, DEG, FRANKY_SPIT, SCRAP_ISLAND, SEA_TRAIN,
} from '../../world/config.js'
import { canalBearingAt, ringRadiusAt, terraceOuterAt } from '../../world/shape.js'

const EXTENT = 720 // world metres from centre to canvas edge

/**
 * Top-down layout map, drawn from the same config the 3D world is built from.
 *
 * This exists to make the blockout checkable: it renders the plan in docs/LAYOUT.md
 * directly, so the terrace radii, canal bearings, dock spacing and landmark placement
 * can be compared against the reference art without flying the camera around.
 */
export default function MapView({ playerState, buildings, visible }) {
  const canvasRef = useRef()

  useEffect(() => {
    if (!visible) return
    let raf
    const draw = () => {
      const cv = canvasRef.current
      if (!cv) return
      const ctx = cv.getContext('2d')
      const S = cv.width
      const k = S / (EXTENT * 2)
      const tx = (x) => S / 2 + x * k
      const tz = (z) => S / 2 + z * k

      ctx.clearRect(0, 0, S, S)
      ctx.fillStyle = '#2a7f9e'
      ctx.fillRect(0, 0, S, S)

      // Terraces, lightest at the summit, traced along their real irregular outlines.
      const tierFill = ['#8d8877', '#9d9784', '#ada693', '#bdb6a2', '#cdc6b1']
      ;[...TIERS].reverse().forEach((t) => {
        ctx.beginPath()
        for (let d = 0; d <= 360; d += 2) {
          const [x, z] = polar(terraceOuterAt(t, d), d)
          if (d === 0) ctx.moveTo(tx(x), tz(z))
          else ctx.lineTo(tx(x), tz(z))
        }
        ctx.closePath()
        ctx.fillStyle = tierFill[t.id]
        ctx.fill()
      })

      // Shoreline.
      ctx.beginPath()
      ctx.arc(tx(0), tz(0), ISLAND_RADIUS * k, 0, Math.PI * 2)
      ctx.strokeStyle = '#5b5a4e'
      ctx.lineWidth = 2
      ctx.stroke()

      // Buildings.
      ctx.fillStyle = 'rgba(150,64,47,0.72)'
      for (const b of buildings) {
        ctx.fillRect(tx(b.x) - 1.6, tz(b.z) - 1.6, 3.2, 3.2)
      }

      // Ramps — the only walkable routes between terraces.
      ctx.strokeStyle = 'rgba(255,238,150,0.85)'
      ctx.lineWidth = 9
      ctx.lineCap = 'round'
      for (const b of RAMP_BEARINGS) {
        const [x0, z0] = polar(40, b)
        const [x1, z1] = polar(ISLAND_RADIUS - 8, b)
        ctx.beginPath()
        ctx.moveTo(tx(x0), tz(z0))
        ctx.lineTo(tx(x1), tz(z1))
        ctx.stroke()
      }

      // Canals, traced along their actual meandering centrelines.
      ctx.strokeStyle = '#2f8f8a'
      ctx.lineCap = 'round'
      for (const ch of RADIAL_CANALS.channels) {
        ctx.lineWidth = ch.halfWidth * 2 * k
        ctx.beginPath()
        for (let r = ch.inner; r <= ISLAND_RADIUS; r += 6) {
          const [x, z] = polar(r, canalBearingAt(ch, r))
          if (r === ch.inner) ctx.moveTo(tx(x), tz(z))
          else ctx.lineTo(tx(x), tz(z))
        }
        ctx.stroke()
      }
      for (const rc of RING_CANALS) {
        ctx.lineWidth = rc.halfWidth * 2 * k
        ctx.beginPath()
        for (let d = 0; d <= 360; d += 3) {
          const [x, z] = polar(ringRadiusAt(rc, d), d)
          if (d === 0) ctx.moveTo(tx(x), tz(z))
          else ctx.lineTo(tx(x), tz(z))
        }
        ctx.closePath()
        ctx.stroke()
      }

      // Sea Train trestle.
      {
        const [sx, sz] = polar(SEA_TRAIN.startRadius, SEA_TRAIN.startBearing)
        const a = SEA_TRAIN.headingDeg * DEG
        ctx.strokeStyle = '#3a3833'
        ctx.lineWidth = 3
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(tx(sx), tz(sz))
        ctx.lineTo(tx(sx + Math.cos(a) * SEA_TRAIN.length), tz(sz + Math.sin(a) * SEA_TRAIN.length))
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Offshore satellites.
      const blob = (l, size, fill) => {
        const [x, z] = polar(l.radius, l.bearing)
        ctx.beginPath()
        ctx.arc(tx(x), tz(z), size * k, 0, Math.PI * 2)
        ctx.fillStyle = fill
        ctx.fill()
      }
      blob(FRANKY_SPIT, FRANKY_SPIT.size, '#3f6fa8')
      blob(SCRAP_ISLAND, SCRAP_ISLAND.size, '#5a5751')

      // Docks.
      ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const d of DOCKS) {
        const [x, z] = polar(d.radius, d.bearing)
        ctx.beginPath()
        ctx.arc(tx(x), tz(z), 11, 0, Math.PI * 2)
        ctx.fillStyle = d.n === 1 ? '#e0b33c' : '#3a3833'
        ctx.fill()
        ctx.fillStyle = d.n === 1 ? '#241d08' : '#f2ede2'
        ctx.fillText(String(d.n), tx(x), tz(z) + 0.5)
      }

      // Landmark pins.
      const pin = (l, text) => {
        const [x, z] = polar(l.radius, l.bearing)
        ctx.beginPath()
        ctx.arc(tx(x), tz(z), 5, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.strokeStyle = '#1d2b34'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillStyle = '#10202a'
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 3
        ctx.strokeText(text, tx(x) + 9, tz(z))
        ctx.fillText(text, tx(x) + 9, tz(z))
        ctx.textAlign = 'center'
      }
      pin(LANDMARKS.greatFountain, 'Great Fountain')
      pin(LANDMARKS.galleyLaHQ, 'Galley-La HQ')
      pin(LANDMARKS.blueStation, 'Blue Station')
      pin(LANDMARKS.marketPlaza, 'Market Plaza')
      pin(LANDMARKS.frankyHouse, 'Franky House')
      pin(LANDMARKS.scrapIsland, 'Scrap Island')

      // Player.
      const p = playerState.current
      if (p) {
        ctx.beginPath()
        ctx.arc(tx(p.x), tz(p.z), 6, 0, Math.PI * 2)
        ctx.fillStyle = '#ff4d3d'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [visible, buildings, playerState])

  if (!visible) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      background: 'rgba(8,20,28,0.72)', zIndex: 20,
    }}>
      <div style={{ textAlign: 'center' }}>
        <canvas
          ref={canvasRef}
          width={760}
          height={760}
          style={{ borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,.5)', maxWidth: '86vmin', maxHeight: '86vmin' }}
        />
        <div style={{ color: '#dfeaf0', marginTop: 10, fontSize: 13, letterSpacing: '.02em' }}>
          Water 7 — layout plan · south (main sea approach) is at the bottom · press <b>M</b> to close
        </div>
      </div>
    </div>
  )
}
