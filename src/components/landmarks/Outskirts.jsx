import { FRANKY_SPIT, SCRAP_ISLAND, polar, DEG } from '../../world/config.js'
import { PALETTE } from '../../world/palette.js'
import { makeRng, rand } from '../../world/rng.js'
import { useMemo } from 'react'

/**
 * Franky House and Scrap Island — the two things that are deliberately *not* part of
 * the city.
 *
 * Franky House sits on its own spit off the north-east shoulder, on the outskirts,
 * scrap-built with gold lettering and the robot arms hanging off its sides. Scrap
 * Island is the man-made heap of debris from hundreds of broken ships further out.
 * Both sit outside the cone's height field, on their own small landmasses.
 */
export default function Outskirts() {
  const [fx, fz] = polar(FRANKY_SPIT.radius, FRANKY_SPIT.bearing)
  const [sx, sz] = polar(SCRAP_ISLAND.radius, SCRAP_ISLAND.bearing)
  const frot = -FRANKY_SPIT.bearing * DEG

  const scrap = useMemo(() => {
    const rng = makeRng(77)
    return Array.from({ length: 46 }, () => ({
      p: [rand(rng, -1, 1) * SCRAP_ISLAND.size * 0.8, rand(rng, 0, 12), rand(rng, -1, 1) * SCRAP_ISLAND.size * 0.8],
      s: [rand(rng, 4, 14), rand(rng, 1.5, 5), rand(rng, 3, 11)],
      r: rand(rng, 0, Math.PI),
      c: rng() < 0.5 ? PALETTE.timberDark : PALETTE.iron,
    }))
  }, [])

  return (
    <group>
      {/* --- Franky House spit --- */}
      <group position={[fx, 0, fz]}>
        <mesh position={[0, FRANKY_SPIT.y / 2 - 4, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[FRANKY_SPIT.size, FRANKY_SPIT.size * 1.25, FRANKY_SPIT.y + 8, 26]} />
          <meshStandardMaterial color={PALETTE.quay} roughness={1} />
        </mesh>
        <group position={[0, FRANKY_SPIT.y, 0]} rotation={[0, frot, 0]}>
          {/* Scrap-built hall. */}
          <mesh position={[0, 9, 0]} castShadow receiveShadow>
            <boxGeometry args={[34, 18, 24]} />
            <meshStandardMaterial color={PALETTE.frankyBlue} roughness={0.88} />
          </mesh>
          {/* FRANKY HOUSE lettering band, in gold. */}
          <mesh position={[0, 14, 12.4]} castShadow>
            <boxGeometry args={[28, 4.4, 1.2]} />
            <meshStandardMaterial color={PALETTE.gold} roughness={0.45} metalness={0.5} />
          </mesh>
          <mesh position={[0, 19.5, 0]} castShadow>
            <boxGeometry args={[36, 3, 26]} />
            <meshStandardMaterial color={PALETTE.timberDark} roughness={0.9} />
          </mesh>
          {/* The robot arms hanging off each side. */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 18, 13, 0]}>
              <mesh position={[s * 5, 0, 0]} rotation={[0, 0, s * 0.5]} castShadow>
                <boxGeometry args={[14, 4.5, 4.5]} />
                <meshStandardMaterial color={PALETTE.iron} roughness={0.6} metalness={0.5} />
              </mesh>
              <mesh position={[s * 12, -4, 0]} castShadow>
                <boxGeometry args={[6, 6, 6]} />
                <meshStandardMaterial color={PALETTE.gold} roughness={0.5} metalness={0.5} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* --- Scrap Island --- */}
      <group position={[sx, 0, sz]}>
        <mesh position={[0, SCRAP_ISLAND.y / 2 - 4, 0]} receiveShadow>
          <cylinderGeometry args={[SCRAP_ISLAND.size, SCRAP_ISLAND.size * 1.3, SCRAP_ISLAND.y + 8, 22]} />
          <meshStandardMaterial color={PALETTE.ashlarDark} roughness={1} />
        </mesh>
        {scrap.map((s, i) => (
          <mesh
            key={i}
            position={[s.p[0], SCRAP_ISLAND.y + s.p[1], s.p[2]]}
            rotation={[0, s.r, s.r * 0.12]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={s.s} />
            <meshStandardMaterial color={s.c} roughness={0.95} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
