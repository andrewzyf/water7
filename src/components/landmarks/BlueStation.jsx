import { LANDMARKS, SEA_TRAIN, polar, DEG, tierById } from '../../world/config.js'
import { PALETTE } from '../../world/palette.js'

/**
 * Blue Station and the Sea Train trestle.
 *
 * The station is the island's only link to the outside world — the Puffing Tom runs
 * from here out across open water on raised rails. Placed on the tier-0 shore at the
 * foot of the north-east ramp, on the one stretch of waterfront the seven docks leave
 * free.
 */
export default function BlueStation() {
  const l = LANDMARKS.blueStation
  const [x, z] = polar(l.radius, l.bearing)
  const y = tierById(0).y
  const rot = -l.bearing * DEG

  // Trestle: leaves the station and runs out over the sea.
  const a = SEA_TRAIN.headingDeg * DEG
  const [sx, sz] = polar(SEA_TRAIN.startRadius, SEA_TRAIN.startBearing)
  const dir = [Math.cos(a), Math.sin(a)]
  const piers = []
  for (let d = 20; d < SEA_TRAIN.length; d += 46) {
    piers.push([sx + dir[0] * d, sz + dir[1] * d])
  }
  const midD = SEA_TRAIN.length / 2

  return (
    <group>
      <group position={[x, y, z]} rotation={[0, rot, 0]}>
        {/* Platform. */}
        <mesh position={[0, 1.6, 0]} receiveShadow castShadow>
          <boxGeometry args={[58, 3.2, 34]} />
          <meshStandardMaterial color={PALETTE.quay} roughness={0.95} />
        </mesh>
        {/* Concourse hall. */}
        <mesh position={[0, 12, -6]} castShadow receiveShadow>
          <boxGeometry args={[46, 18, 20]} />
          <meshStandardMaterial color={PALETTE.plaster[4]} roughness={0.9} />
        </mesh>
        <mesh position={[0, 21, -6]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.58]} castShadow>
          <cylinderGeometry args={[23, 23, 20, 28]} />
          <meshStandardMaterial color={PALETTE.terracotta[3]} roughness={0.8} />
        </mesh>
        {/* Clock tower. */}
        <mesh position={[19, 20, 8]} castShadow>
          <cylinderGeometry args={[4.6, 5, 40, 18]} />
          <meshStandardMaterial color={PALETTE.plaster[0]} roughness={0.9} />
        </mesh>
        <mesh position={[19, 42, 8]} castShadow>
          <sphereGeometry args={[4.9, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={PALETTE.terracotta[0]} roughness={0.8} />
        </mesh>
        {/* Open train shed over the platform edge. */}
        <mesh position={[0, 9, 13]} castShadow>
          <boxGeometry args={[52, 1.2, 12]} />
          <meshStandardMaterial color={PALETTE.terracotta[1]} roughness={0.85} />
        </mesh>
        {[-24, -8, 8, 24].map((ox) => (
          <mesh key={ox} position={[ox, 5.5, 17]} castShadow>
            <boxGeometry args={[1.1, 8, 1.1]} />
            <meshStandardMaterial color={PALETTE.iron} roughness={0.7} metalness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Trestle piers marching out to sea. */}
      {piers.map(([px, pz], i) => (
        <mesh key={i} position={[px, SEA_TRAIN.deckY / 2 - 4, pz]} castShadow>
          <boxGeometry args={[7, SEA_TRAIN.deckY + 8, 7]} />
          <meshStandardMaterial color={PALETTE.ashlarDark} roughness={0.95} />
        </mesh>
      ))}
      {/* Deck and rails. */}
      <mesh
        position={[sx + dir[0] * midD, SEA_TRAIN.deckY, sz + dir[1] * midD]}
        rotation={[0, -a, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[SEA_TRAIN.length, 1.4, 11]} />
        <meshStandardMaterial color={PALETTE.timberDark} roughness={0.95} />
      </mesh>
      {[-2.4, 2.4].map((off) => (
        <mesh
          key={off}
          position={[
            sx + dir[0] * midD - dir[1] * off,
            SEA_TRAIN.deckY + 1.1,
            sz + dir[1] * midD + dir[0] * off,
          ]}
          rotation={[0, -a, 0]}
        >
          <boxGeometry args={[SEA_TRAIN.length, 0.5, 0.6]} />
          <meshStandardMaterial color={PALETTE.iron} roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
    </group>
  )
}
