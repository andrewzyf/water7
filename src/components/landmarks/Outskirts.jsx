import { useMemo } from 'react'
import * as THREE from 'three'
import { FRANKY_SPIT, SCRAP_ISLAND, polar, DEG, outwardYaw, ISLAND_RADIUS } from '../../world/config.js'
import { PALETTE } from '../../world/palette.js'
import { makeRng, rand, pick } from '../../world/rng.js'
import { mergeSimple } from '../../world/arch.js'
import { timberTexture, ashlarTexture, plasterTexture } from '../../world/textures.js'
import { terraceOuterAt } from '../../world/shape.js'
import { TIERS } from '../../world/config.js'

/**
 * Franky House and Scrap Island.
 *
 * The two things on Water 7 that are deliberately not *of* Water 7: no terracotta, no
 * plaster, no arcades. Franky House is welded together out of salvage on its own spit
 * at the edge of town — gold lettering across the front, the robot arms hanging off
 * both sides — and Scrap Island beyond it is the debris of hundreds of broken ships,
 * where the Thousand Sunny will eventually be built.
 */

function frankySignTexture() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2c4f7c'
  ctx.fillRect(0, 0, 1024, 256)
  // Riveted plate.
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  for (let x = 18; x < 1024; x += 46) {
    ctx.beginPath(); ctx.arc(x, 22, 6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(x, 234, 6, 0, Math.PI * 2); ctx.fill()
  }
  ctx.font = 'bold 128px Impact, "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 12
  ctx.strokeStyle = '#5c3c0d'
  ctx.strokeText('FRANKY HOUSE', 512, 132)
  const g = ctx.createLinearGradient(0, 60, 0, 200)
  g.addColorStop(0, '#ffe28a')
  g.addColorStop(0.5, '#d9a441')
  g.addColorStop(1, '#a97722')
  ctx.fillStyle = g
  ctx.fillText('FRANKY HOUSE', 512, 132)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** A jointed mechanical arm: upper, elbow, forearm, fist. */
function robotArmGeometry(side) {
  const parts = []
  const upper = new THREE.BoxGeometry(13, 4.6, 4.6)
  upper.rotateZ(side * 0.34)
  upper.translate(side * 6.5, 1.2, 0)
  parts.push(upper)

  const elbow = new THREE.SphereGeometry(3.1, 14, 10)
  elbow.translate(side * 12.6, 3.4, 0)
  parts.push(elbow)

  const fore = new THREE.BoxGeometry(4.4, 11, 4.4)
  fore.rotateZ(side * -0.22)
  fore.translate(side * 14.2, -2.4, 0)
  parts.push(fore)

  const fist = new THREE.BoxGeometry(6.4, 5.6, 6.4)
  fist.translate(side * 15.6, -8.6, 0)
  parts.push(fist)

  // Hydraulic rams along the upper arm.
  for (const off of [-1.6, 1.6]) {
    const ram = new THREE.CylinderGeometry(0.55, 0.55, 10, 8)
    ram.rotateZ(Math.PI / 2 + side * 0.34)
    ram.translate(side * 6.2, 3.6, off)
    parts.push(ram)
  }
  return mergeSimple(parts)
}

/** Mismatched salvaged plates riveted over the walls. */
function scrapCladdingGeometry(w, h, d, seed) {
  const rng = makeRng(seed)
  const parts = []
  for (let i = 0; i < 26; i++) {
    const face = Math.floor(rng() * 4)
    const pw = rand(rng, 3, 9)
    const ph = rand(rng, 2, 6)
    const g = new THREE.BoxGeometry(pw, ph, 0.4)
    const u = rand(rng, -0.42, 0.42)
    const v = rand(rng, 0.1, 0.86)
    if (face < 2) {
      g.translate(u * w, v * h, (face === 0 ? 1 : -1) * (d / 2 + 0.2))
    } else {
      g.rotateY(Math.PI / 2)
      g.translate((face === 2 ? 1 : -1) * (w / 2 + 0.2), v * h, u * d)
    }
    parts.push(g)
  }
  return mergeSimple(parts)
}

export default function Outskirts() {
  const [fx, fz] = polar(FRANKY_SPIT.radius, FRANKY_SPIT.bearing)
  const [sx, sz] = polar(SCRAP_ISLAND.radius, SCRAP_ISLAND.bearing)
  const frot = outwardYaw(FRANKY_SPIT.bearing)

  const sign = useMemo(frankySignTexture, [])
  const tex = useMemo(() => {
    const timber = timberTexture(); timber.repeat.set(3, 2)
    const stone = ashlarTexture(512, 6); stone.repeat.set(4, 2)
    const plaster = plasterTexture(); plaster.repeat.set(3, 2)
    return { timber, stone, plaster }
  }, [])

  const arms = useMemo(() => ({ left: robotArmGeometry(-1), right: robotArmGeometry(1) }), [])
  const cladding = useMemo(() => scrapCladdingGeometry(36, 20, 26, 1234), [])

  const scrap = useMemo(() => {
    const rng = makeRng(77)
    return Array.from({ length: 64 }, () => ({
      p: [
        rand(rng, -1, 1) * SCRAP_ISLAND.size * 0.85,
        rand(rng, 0, 14),
        rand(rng, -1, 1) * SCRAP_ISLAND.size * 0.85,
      ],
      s: [rand(rng, 4, 15), rand(rng, 1.5, 5), rand(rng, 3, 12)],
      r: rand(rng, 0, Math.PI),
      tilt: rand(rng, -0.35, 0.35),
      c: pick(rng, ['#5f4930', '#4a4844', '#6b5a42', '#3f4750', '#7a6244']),
    }))
  }, [])

  // Timber causeway linking the spit to the island shore.
  const causeway = useMemo(() => {
    const parts = []
    const shoreR = terraceOuterAt(TIERS[TIERS.length - 1], FRANKY_SPIT.bearing) - 4
    const a = FRANKY_SPIT.bearing * DEG
    const from = shoreR
    const to = FRANKY_SPIT.radius - FRANKY_SPIT.size * 0.9
    const len = to - from
    if (len > 4) {
      const deck = new THREE.BoxGeometry(len, 1.2, 8)
      deck.rotateY(-a)
      deck.translate(((from + to) / 2) * Math.cos(a), 6.2, ((from + to) / 2) * Math.sin(a))
      parts.push(deck)
      for (let d = from + 4; d < to; d += 11) {
        for (const s of [-1, 1]) {
          const pile = new THREE.CylinderGeometry(0.7, 0.7, 18, 8)
          pile.translate(
            d * Math.cos(a) - Math.sin(a) * s * 3,
            -2,
            d * Math.sin(a) + Math.cos(a) * s * 3,
          )
          parts.push(pile)
        }
      }
    }
    return parts.length ? mergeSimple(parts) : null
  }, [])

  return (
    <group>
      {/* --- Franky House, on its spit --- */}
      <group position={[fx, 0, fz]}>
        <mesh position={[0, FRANKY_SPIT.y / 2 - 5, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[FRANKY_SPIT.size, FRANKY_SPIT.size * 1.3, FRANKY_SPIT.y + 10, 30]} />
          <meshStandardMaterial map={tex.stone} color="#a89e8b" roughness={1} />
        </mesh>

        <group position={[0, FRANKY_SPIT.y, 0]} rotation={[0, frot, 0]}>
          <mesh position={[0, 10, 0]} castShadow receiveShadow>
            <boxGeometry args={[36, 20, 26]} />
            <meshStandardMaterial map={tex.timber} color={PALETTE.frankyBlue} roughness={0.82} metalness={0.2} />
          </mesh>
          <mesh geometry={cladding} position={[0, 0, 0]} castShadow>
            <meshStandardMaterial color="#35608f" roughness={0.7} metalness={0.32} />
          </mesh>

          {/* Signboard across the front. */}
          <mesh position={[0, 14.5, 13.4]}>
            <planeGeometry args={[30, 7.5]} />
            <meshStandardMaterial map={sign} roughness={0.62} metalness={0.25} />
          </mesh>

          {/* Flat salvaged roof with a parapet. */}
          <mesh position={[0, 20.8, 0]} castShadow>
            <boxGeometry args={[38, 1.6, 28]} />
            <meshStandardMaterial color="#3b3a37" roughness={0.85} metalness={0.25} />
          </mesh>
          <mesh position={[0, 22.4, 0]} castShadow>
            <boxGeometry args={[38.6, 1.8, 28.6]} />
            <meshStandardMaterial color="#2b3a4a" roughness={0.8} metalness={0.3} />
          </mesh>

          {/* Chimney stacks. */}
          {[-11, 11].map((ox) => (
            <mesh key={ox} position={[ox, 26, -8]} castShadow>
              <cylinderGeometry args={[1.5, 1.8, 8, 12]} />
              <meshStandardMaterial color="#2f3438" roughness={0.75} metalness={0.35} />
            </mesh>
          ))}

          {/* The robot arms. */}
          <mesh geometry={arms.left} position={[-18, 14, 0]} castShadow>
            <meshStandardMaterial color={PALETTE.iron} roughness={0.55} metalness={0.62} />
          </mesh>
          <mesh geometry={arms.right} position={[18, 14, 0]} castShadow>
            <meshStandardMaterial color={PALETTE.iron} roughness={0.55} metalness={0.62} />
          </mesh>

          {/* Big roller door. */}
          <mesh position={[0, 4.6, 13.2]}>
            <planeGeometry args={[13, 9]} />
            <meshStandardMaterial color="#4a5560" roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      </group>

      {causeway && (
        <mesh geometry={causeway} castShadow receiveShadow>
          <meshStandardMaterial map={tex.timber} color="#6a563a" roughness={0.94} />
        </mesh>
      )}

      {/* --- Scrap Island --- */}
      <group position={[sx, 0, sz]}>
        <mesh position={[0, SCRAP_ISLAND.y / 2 - 5, 0]} receiveShadow>
          <cylinderGeometry args={[SCRAP_ISLAND.size, SCRAP_ISLAND.size * 1.35, SCRAP_ISLAND.y + 10, 24]} />
          <meshStandardMaterial map={tex.stone} color="#6f6a60" roughness={1} />
        </mesh>
        {scrap.map((s, i) => (
          <mesh
            key={i}
            position={[s.p[0], SCRAP_ISLAND.y + s.p[1], s.p[2]]}
            rotation={[s.tilt * 0.5, s.r, s.tilt]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={s.s} />
            <meshStandardMaterial map={tex.timber} color={s.c} roughness={0.92} metalness={0.15} />
          </mesh>
        ))}
        {/* A broken mast leaning out of the heap. */}
        <mesh position={[4, SCRAP_ISLAND.y + 14, -6]} rotation={[0, 0, 0.5]} castShadow>
          <cylinderGeometry args={[0.9, 1.3, 30, 10]} />
          <meshStandardMaterial map={tex.timber} color="#6b5a42" roughness={0.92} />
        </mesh>
      </group>
    </group>
  )
}
