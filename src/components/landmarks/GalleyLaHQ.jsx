import { LANDMARKS, polar, DEG, tierById } from '../../world/config.js'
import { PALETTE } from '../../world/palette.js'

/**
 * Galley-La Company headquarters — also Iceburg's home and the mayor's office, and the
 * largest house on the island. Sited on the civic terrace directly above Dock 1, so it
 * looks straight down the ceremonial spine to its own flagship yard.
 *
 * Massing merges both on-screen buildings: the tall pale stone block with the round
 * oculus, and the broad timber hall carrying the company name.
 */
export default function GalleyLaHQ() {
  const l = LANDMARKS.galleyLaHQ
  const [x, z] = polar(l.radius, l.bearing)
  const y = tierById(2).y
  const rot = -l.bearing * DEG

  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      {/* Grounds. */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[74, 0.24, 56]} />
        <meshStandardMaterial color={PALETTE.grass} roughness={1} />
      </mesh>

      {/* Broad timber hall — the GALLEY-LA COMPANY frontage. */}
      <mesh position={[0, 9, 12]} castShadow receiveShadow>
        <boxGeometry args={[54, 18, 22]} />
        <meshStandardMaterial color={PALETTE.galleyLaBlue} roughness={0.85} />
      </mesh>
      <mesh position={[0, 18, 12]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.58]} castShadow>
        <cylinderGeometry args={[27, 27, 22, 28]} />
        <meshStandardMaterial color={PALETTE.terracotta[0]} roughness={0.8} />
      </mesh>

      {/* Tall stone block behind — Iceburg's residence and office. */}
      <mesh position={[0, 17, -14]} castShadow receiveShadow>
        <boxGeometry args={[34, 34, 26]} />
        <meshStandardMaterial color={PALETTE.plaster[3]} roughness={0.9} />
      </mesh>
      {/* Round oculus window. */}
      <mesh position={[0, 26, -0.7]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[4.4, 4.4, 1.6, 24]} />
        <meshStandardMaterial color={PALETTE.glass} roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Barrel roof + corner turrets. */}
      <mesh position={[0, 34, -14]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.6]} castShadow>
        <cylinderGeometry args={[17, 17, 26, 24]} />
        <meshStandardMaterial color={PALETTE.terracotta[2]} roughness={0.8} />
      </mesh>
      {[[-19, -24], [19, -24]].map(([ox, oz], i) => (
        <group key={i} position={[ox, 0, oz]}>
          <mesh position={[0, 21, 0]} castShadow>
            <cylinderGeometry args={[5.5, 5.5, 42, 18]} />
            <meshStandardMaterial color={PALETTE.plaster[0]} roughness={0.9} />
          </mesh>
          <mesh position={[0, 45, 0]} castShadow>
            <sphereGeometry args={[5.7, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={PALETTE.terracotta[1]} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
