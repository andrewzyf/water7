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

export default function Hud({ playerState, showMap, mode, quality }) {
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
        speed: p.speed,
        riding: p.riding,
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
          {mode === 'boat'
            ? `${info?.riding ? 'riding a Yagara' : 'under way'} · ${Math.abs(info?.speed ?? 0).toFixed(1)} m/s`
            : `elevation ${info ? info.alt.toFixed(1) : '0.0'} m`}
        </div>
      </div>

      <div style={{ ...panel, bottom: 12, left: 12 }}>
        {mode === 'boat' ? (
          <>
            <span style={key}>W</span><span style={key}>S</span> throttle
            &nbsp;·&nbsp; <span style={key}>A</span><span style={key}>D</span> steer
            &nbsp;·&nbsp; <b>click</b> to look around
          </>
        ) : (
          <>
            <span style={key}>W</span><span style={key}>A</span><span style={key}>S</span><span style={key}>D</span> walk
            &nbsp;·&nbsp; <span style={key}>Shift</span> run
            &nbsp;·&nbsp; <span style={key}>Space</span> jump
            &nbsp;·&nbsp; <b>drag</b> or click to look
            &nbsp;·&nbsp; <b>scroll</b> to zoom
          </>
        )}
        <br />
        <span style={key}>E</span> {mode === 'boat' ? 'dismount' : 'ride a Yagara or take a boat (near water)'}
        &nbsp;·&nbsp; <span style={key}>M</span> map
        &nbsp;·&nbsp; <span style={key}>Q</span> graphics: <b>{quality}</b>
        &nbsp;·&nbsp; <span style={key}>Esc</span> cursor
      </div>
    </>
  )
}
