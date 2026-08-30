import { useEffect, useState } from 'react'
import { TIERS, ISLAND_RADIUS } from '../../world/config.js'

const panel = {
  position: 'absolute',
  padding: '10px 13px',
  background: 'rgba(12,26,34,0.72)',
  color: '#e7f1f6',
  borderRadius: 9,
  fontSize: 12.5,
  lineHeight: 1.6,
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.13)',
  pointerEvents: 'none',
  zIndex: 10,
}

const key = {
  display: 'inline-block',
  minWidth: 17,
  padding: '1px 5px',
  margin: '0 2px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.15)',
  fontWeight: 700,
  textAlign: 'center',
}

export default function Hud({ playerState, showLabels, showMap }) {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const id = setInterval(() => {
      const p = playerState.current
      if (!p) return
      const tier = p.r < ISLAND_RADIUS ? TIERS.find((t) => p.r < t.outer) : null
      setInfo({
        district: tier ? tier.name : 'Open Sea',
        alt: p.y,
        running: p.running,
        onBridge: p.onBridge,
      })
    }, 140)
    return () => clearInterval(id)
  }, [playerState])

  return (
    <>
      <div style={{ ...panel, top: 12, left: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.04em', marginBottom: 4 }}>
          WATER 7
        </div>
        <div style={{ opacity: 0.85 }}>
          {info ? info.district : '—'}
          {info?.onBridge ? ' · on a bridge' : ''}
        </div>
        <div style={{ opacity: 0.6, fontSize: 11.5 }}>
          elevation {info ? info.alt.toFixed(1) : '0.0'} m
        </div>
      </div>

      <div style={{ ...panel, bottom: 12, left: 12 }}>
        <span style={key}>W</span><span style={key}>A</span><span style={key}>S</span><span style={key}>D</span> walk
        &nbsp;·&nbsp; <span style={key}>Shift</span> run
        &nbsp;·&nbsp; <b>click</b> to look around
        <br />
        <span style={key}>M</span> layout map {showMap ? '(open)' : ''}
        &nbsp;·&nbsp; <span style={key}>L</span> labels {showLabels ? 'on' : 'off'}
        &nbsp;·&nbsp; <span style={key}>Esc</span> release cursor
      </div>

      <div style={{ ...panel, top: 12, right: 12, maxWidth: 230 }}>
        <b>Blockout</b> — layout review build.
        <div style={{ opacity: 0.72, marginTop: 3 }}>
          Massing and geography only. Detailed geometry is held until the layout is
          signed off.
        </div>
      </div>
    </>
  )
}
