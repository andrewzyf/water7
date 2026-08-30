import { Html } from '@react-three/drei'
import { LANDMARKS, DOCKS, polar, tierById, GREAT_FOUNTAIN } from '../../world/config.js'

const chip = {
  padding: '3px 8px',
  borderRadius: 999,
  background: 'rgba(14,32,42,0.82)',
  color: '#eef6fa',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  letterSpacing: '.02em',
  border: '1px solid rgba(255,255,255,0.22)',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
}

/** Floating landmark names, so the blockout can be read without guessing. Toggle: L. */
export default function Labels() {
  /** Landmark, label height above its own ground, text. */
  const pins = [
    [LANDMARKS.greatFountain, tierById(4).y + GREAT_FOUNTAIN.spireHeight + 28, 'The Great Fountain'],
    [LANDMARKS.galleyLaHQ, tierById(2).y + 58, 'Galley-La HQ / Iceburg’s Office'],
    [LANDMARKS.blueStation, tierById(0).y + 50, 'Blue Station — Sea Train'],
    [LANDMARKS.marketPlaza, tierById(1).y + 22, 'Market Plaza'],
    [LANDMARKS.frankyHouse, 34, 'Franky House'],
    [LANDMARKS.scrapIsland, 24, 'Scrap Island'],
  ]

  return (
    <group>
      {pins.map(([l, y, text]) => {
        const [x, z] = polar(l.radius, l.bearing)
        return (
          <Html key={text} position={[x, y, z]} center distanceFactor={260} zIndexRange={[10, 0]}>
            <div style={chip}>{text}</div>
          </Html>
        )
      })}
      {DOCKS.map((d) => {
        const [x, z] = polar(d.radius - 12, d.bearing)
        return (
          <Html key={d.n} position={[x, tierById(0).y + 34, z]} center distanceFactor={260} zIndexRange={[10, 0]}>
            <div style={{ ...chip, background: d.n === 1 ? 'rgba(200,140,40,0.92)' : chip.background }}>
              Dock {d.n}{d.n === 1 ? ' — flagship' : ''}
            </div>
          </Html>
        )
      })}
    </group>
  )
}
