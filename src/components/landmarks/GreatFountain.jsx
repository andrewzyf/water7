import { GREAT_FOUNTAIN, tierById } from '../../world/config.js'
import { PALETTE } from '../../world/palette.js'

/**
 * The Great Fountain crowning the summit — the source every canal on the island runs
 * from, and the reason the city reads as "a giant fountain in a volcano shape".
 * Blockout massing: a tiered basin stack under a tapering spire.
 */
export default function GreatFountain() {
  const y = tierById(4).y
  const { basinRadius, spireHeight } = GREAT_FOUNTAIN

  const tiers = [
    { r: basinRadius, h: 4, y: 0 },
    { r: basinRadius * 0.74, h: 5, y: 4 },
    { r: basinRadius * 0.52, h: 6, y: 9 },
    { r: basinRadius * 0.34, h: 7, y: 15 },
  ]

  return (
    <group position={[0, y, 0]}>
      {tiers.map((t, i) => (
        <mesh key={i} position={[0, t.y + t.h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[t.r * 0.88, t.r, t.h, 40]} />
          <meshStandardMaterial
            color={i % 2 ? PALETTE.fountainBlue : PALETTE.fountainPale}
            roughness={0.6}
          />
        </mesh>
      ))}
      {/* Water held in the crown basin. */}
      <mesh position={[0, 21.4, 0]}>
        <cylinderGeometry args={[basinRadius * 0.31, basinRadius * 0.31, 0.4, 36]} />
        <meshStandardMaterial color={PALETTE.canal} roughness={0.1} metalness={0.6} />
      </mesh>
      {/* Spire. */}
      <mesh position={[0, 22 + spireHeight / 2, 0]} castShadow>
        <coneGeometry args={[basinRadius * 0.26, spireHeight, 24]} />
        <meshStandardMaterial color={PALETTE.fountainPale} roughness={0.5} />
      </mesh>
      <mesh position={[0, 22 + spireHeight + 3, 0]} castShadow>
        <sphereGeometry args={[2.4, 16, 12]} />
        <meshStandardMaterial color={PALETTE.fountainBlue} roughness={0.3} metalness={0.3} />
      </mesh>
    </group>
  )
}
