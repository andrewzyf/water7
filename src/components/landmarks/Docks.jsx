import { DOCKS, polar, DEG, tierById } from '../../world/config.js'
import { DOCK_BASIN } from '../../world/terrain.js'
import { PALETTE } from '../../world/palette.js'

/**
 * The seven Galley-La dry docks.
 *
 * The basin itself is carved into the height field; this adds the built parts — the
 * numbered gate wall at the seaward end (each dock is entered "through a towering door
 * with its number on it"), the sill holding the sea out of the drained basin, and a
 * gantry crane. Dock 1 gets the heavy crane and the largest gate, matching the only
 * dock the series actually shows.
 */
function Dock({ dock }) {
  const [cx, cz] = polar(dock.radius, dock.bearing)
  const a = dock.bearing * DEG
  const rot = -a // local X tangential, local Z radial-outward
  const half = dock.width / 2
  const isFlagship = dock.n === 1
  const gateH = isFlagship ? 26 : 18 + (dock.n % 3) * 2
  const tier0 = tierById(0)

  // Seaward sill, at the outer lip of the basin.
  const [sx, sz] = polar(DOCK_BASIN.sillR + 3, dock.bearing)
  // Landward gate wall, at the back of the basin.
  const [gx, gz] = polar(DOCK_BASIN.innerR - 4, dock.bearing)

  return (
    <group>
      {/* Sill / caisson gate keeping the sea out of the drained basin. */}
      <mesh position={[sx, 0.5, sz]} rotation={[0, rot, 0]} castShadow receiveShadow>
        <boxGeometry args={[dock.width + 10, 11, 9]} />
        <meshStandardMaterial color={PALETTE.ashlarDark} roughness={0.95} />
      </mesh>

      {/* The numbered gate wall at the head of the dock. */}
      <group position={[gx, tier0.y, gz]} rotation={[0, rot, 0]}>
        <mesh position={[0, gateH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[dock.width + 6, gateH, 5]} />
          <meshStandardMaterial color={PALETTE.plaster[1]} roughness={0.9} />
        </mesh>
        {/* Arched opening. */}
        <mesh position={[0, gateH * 0.34, 2.7]} castShadow>
          <boxGeometry args={[dock.width * 0.46, gateH * 0.62, 1.2]} />
          <meshStandardMaterial color={PALETTE.timberDark} roughness={0.9} />
        </mesh>
        {/* Roof band, in the island's terracotta. */}
        <mesh position={[0, gateH + 1.2, 0]} castShadow>
          <boxGeometry args={[dock.width + 8, 2.4, 7]} />
          <meshStandardMaterial color={PALETTE.terracotta[0]} roughness={0.8} />
        </mesh>
      </group>

      {/* Gantry crane straddling the basin. */}
      <group position={[cx, DOCK_BASIN.floorY, cz]} rotation={[0, rot, 0]}>
        {[-half * 0.72, half * 0.72].map((ox, i) => (
          <mesh key={i} position={[ox, 13, 0]} castShadow>
            <boxGeometry args={[2.2, 26, 2.2]} />
            <meshStandardMaterial color={PALETTE.iron} roughness={0.7} metalness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 26.5, 0]} castShadow>
          <boxGeometry args={[dock.width * 1.5, 2.4, 3]} />
          <meshStandardMaterial color={PALETTE.iron} roughness={0.7} metalness={0.35} />
        </mesh>
        {isFlagship && (
          <mesh position={[0, 20, 0]} castShadow>
            <boxGeometry args={[6, 12, 6]} />
            <meshStandardMaterial color={PALETTE.timberDark} roughness={0.85} />
          </mesh>
        )}
        {/* Keel blocks and stacked timber on the basin floor. */}
        {[-1, 0, 1].map((k) => (
          <mesh key={k} position={[0, 1.1, k * 14]} castShadow receiveShadow>
            <boxGeometry args={[dock.width * 0.5, 2.2, 5]} />
            <meshStandardMaterial color={PALETTE.timber} roughness={0.95} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function Docks() {
  return (
    <group>
      {DOCKS.map((d) => (
        <Dock key={d.n} dock={d} />
      ))}
    </group>
  )
}
