import { useMemo } from 'react'
import * as THREE from 'three'
import { LANDMARKS, SEA_TRAIN, polar, DEG, tierById, outwardYaw } from '../../world/config.js'
import { PALETTE } from '../../world/palette.js'
import { archWallGeometry, columnGeometry, mergeSimple } from '../../world/arch.js'
import { ashlarTexture, plasterTexture, timberTexture, roofTileTexture } from '../../world/textures.js'
import BarrelRoof from '../BarrelRoof.jsx'

/**
 * Blue Station, the Sea Train trestle, and the Puffing Tom.
 *
 * The station is Water 7's only link to the outside world — the one place the island
 * touches anywhere else. The rails leaving it across open water are the arc's single
 * most distinctive silhouette, so the trestle is built out to the horizon and the train
 * is standing at the platform.
 */

function clockFaceTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#f4ecd8'
  ctx.beginPath()
  ctx.arc(128, 128, 122, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#3c4650'
  ctx.lineWidth = 9
  ctx.stroke()
  ctx.strokeStyle = '#3c4650'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    ctx.lineWidth = i % 3 === 0 ? 9 : 4
    ctx.beginPath()
    ctx.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96)
    ctx.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112)
    ctx.stroke()
  }
  // Hands at a calm late afternoon.
  ctx.lineCap = 'round'
  ctx.lineWidth = 11
  ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + 54, 128 - 30); ctx.stroke()
  ctx.lineWidth = 7
  ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + 18, 128 - 86); ctx.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** The Puffing Tom: sea-train locomotive plus carriages. */
function TrainCar({ position, rotation, kind, tex }) {
  const body = kind === 'loco'
    ? { len: 15, w: 5.2, h: 5.6, color: '#2f4256' }
    : { len: 13, w: 5.0, h: 5.0, color: '#3d5a70' }
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Boat-shaped hull under the carriage — it runs on the sea, after all. */}
      <mesh position={[0, -1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[body.len, 2.2, body.w + 0.8]} />
        <meshStandardMaterial map={tex.timber} color="#6d5537" roughness={0.9} />
      </mesh>
      <mesh position={[0, body.h / 2 + 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[body.len, body.h, body.w]} />
        <meshStandardMaterial color={body.color} roughness={0.68} metalness={0.16} />
      </mesh>
      {/* Roof. */}
      <mesh position={[0, body.h + 0.6, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.42, 1, 1]} castShadow>
        <cylinderGeometry args={[body.w * 0.56, body.w * 0.56, body.len, 18]} />
        <meshStandardMaterial color="#8b3a2c" roughness={0.72} />
      </mesh>
      {/* Windows. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, body.h * 0.62, s * (body.w / 2 + 0.03)]}>
          <planeGeometry args={[body.len * 0.82, body.h * 0.34]} />
          <meshStandardMaterial
            color="#cfe3ee"
            roughness={0.18}
            metalness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {kind === 'loco' && (
        <>
          <mesh position={[body.len * 0.34, body.h + 2.6, 0]} castShadow>
            <cylinderGeometry args={[1.15, 1.5, 4.4, 16]} />
            <meshStandardMaterial color="#22303c" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[body.len * 0.34, body.h + 5.0, 0]} castShadow>
            <cylinderGeometry args={[1.5, 1.15, 1.0, 16]} />
            <meshStandardMaterial color="#1b262f" roughness={0.6} />
          </mesh>
          {/* Cowcatcher. */}
          <mesh position={[body.len * 0.55, 0.4, 0]} rotation={[0, 0, -0.5]} castShadow>
            <boxGeometry args={[3.4, 0.6, body.w * 0.9]} />
            <meshStandardMaterial color="#3a2f28" roughness={0.8} metalness={0.2} />
          </mesh>
        </>
      )}
    </group>
  )
}

export default function BlueStation() {
  const l = LANDMARKS.blueStation
  const [x, z] = polar(l.radius, l.bearing)
  const y = tierById(0).y
  const rot = outwardYaw(l.bearing) // facade looks down the slope to the harbour

  const tex = useMemo(() => {
    const ashlar = ashlarTexture(512, 6); ashlar.repeat.set(5, 2)
    const plaster = plasterTexture(); plaster.repeat.set(4, 2)
    const timber = timberTexture(); timber.repeat.set(3, 1)
    const tile = roofTileTexture(); tile.repeat.set(4, 1)
    return { ashlar, plaster, timber, tile }
  }, [])
  const clock = useMemo(clockFaceTexture, [])

  const facade = useMemo(() => archWallGeometry({
    width: 54, height: 20, depth: 3.2,
    openWidth: 6.4, openHeight: 12, count: 5, gap: 3.2,
  }), [])

  // Trestle geometry, running out over open water.
  const trestle = useMemo(() => {
    const a = SEA_TRAIN.headingDeg * DEG
    const [sx, sz] = polar(SEA_TRAIN.startRadius, SEA_TRAIN.startBearing)
    const dir = [Math.cos(a), Math.sin(a)]
    const parts = []
    for (let d = 16; d < SEA_TRAIN.length; d += 34) {
      const px = sx + dir[0] * d
      const pz = sz + dir[1] * d
      // Trestle bent: two raking legs and a cap.
      for (const s of [-1, 1]) {
        const leg = new THREE.BoxGeometry(2.0, SEA_TRAIN.deckY + 15, 2.0)
        leg.rotateX(s * 0.09)
        leg.translate(px - dir[1] * s * 3.6, (SEA_TRAIN.deckY - 15) / 2, pz + dir[0] * s * 3.6)
        parts.push(leg)
      }
      const cap = new THREE.BoxGeometry(2.2, 1.4, 11)
      cap.rotateY(-a)
      cap.translate(px, SEA_TRAIN.deckY - 1.4, pz)
      parts.push(cap)
    }
    return mergeSimple(parts)
  }, [])

  const railGeom = useMemo(() => {
    const a = SEA_TRAIN.headingDeg * DEG
    const [sx, sz] = polar(SEA_TRAIN.startRadius, SEA_TRAIN.startBearing)
    const dir = [Math.cos(a), Math.sin(a)]
    const mid = SEA_TRAIN.length / 2
    const parts = []
    const deck = new THREE.BoxGeometry(SEA_TRAIN.length, 1.2, 10)
    deck.rotateY(-a)
    deck.translate(sx + dir[0] * mid, SEA_TRAIN.deckY, sz + dir[1] * mid)
    parts.push(deck)
    for (const off of [-2.3, 2.3]) {
      const rail = new THREE.BoxGeometry(SEA_TRAIN.length, 0.42, 0.5)
      rail.rotateY(-a)
      rail.translate(
        sx + dir[0] * mid - dir[1] * off,
        SEA_TRAIN.deckY + 0.8,
        sz + dir[1] * mid + dir[0] * off,
      )
      parts.push(rail)
    }
    // Sleepers.
    for (let d = 4; d < SEA_TRAIN.length; d += 4.5) {
      const sl = new THREE.BoxGeometry(1.2, 0.34, 7)
      sl.rotateY(-a)
      sl.translate(sx + dir[0] * d, SEA_TRAIN.deckY + 0.66, sz + dir[1] * d)
      parts.push(sl)
    }
    return parts
  }, [])

  const train = useMemo(() => {
    const a = SEA_TRAIN.headingDeg * DEG
    const [sx, sz] = polar(SEA_TRAIN.startRadius, SEA_TRAIN.startBearing)
    const dir = [Math.cos(a), Math.sin(a)]
    const cars = []
    let d = 26
    cars.push({ kind: 'loco', d })
    for (let i = 0; i < 3; i++) { d += 16.5; cars.push({ kind: 'car', d }) }
    return cars.map((c) => ({
      ...c,
      position: [sx + dir[0] * c.d, SEA_TRAIN.deckY + 2.4, sz + dir[1] * c.d],
      rotation: -a,
    }))
  }, [])

  return (
    <group>
      <group position={[x, y, z]} rotation={[0, rot, 0]}>
        {/* Platform apron. */}
        <mesh position={[0, 1.7, 0]} receiveShadow castShadow>
          <boxGeometry args={[62, 3.4, 38]} />
          <meshStandardMaterial map={tex.ashlar} color={PALETTE.quay} roughness={0.95} />
        </mesh>

        {/* Concourse: arcaded front, hall behind, barrel roof over. */}
        <mesh geometry={facade} position={[0, 3.4, 11]} castShadow receiveShadow>
          <meshStandardMaterial map={tex.plaster} color={PALETTE.plaster[4]} roughness={0.9} />
        </mesh>
        <mesh position={[0, 13.4, -2]} castShadow receiveShadow>
          <boxGeometry args={[54, 20, 24]} />
          <meshStandardMaterial map={tex.plaster} color={PALETTE.plaster[3]} roughness={0.9} />
        </mesh>
        <BarrelRoof
          position={[0, 23.4, -2]}
          width={54} depth={24} rise={0.46}
          map={tex.tile} color={PALETTE.terracotta[3]}
        />

        {/* Clock tower. */}
        <mesh position={[24, 24, 6]} castShadow receiveShadow>
          <cylinderGeometry args={[5.0, 5.6, 48, 20]} />
          <meshStandardMaterial map={tex.plaster} color={PALETTE.plaster[0]} roughness={0.9} />
        </mesh>
        <mesh position={[24, 43, 11.1]}>
          <circleGeometry args={[3.4, 32]} />
          <meshStandardMaterial map={clock} roughness={0.7} />
        </mesh>
        <mesh position={[24, 49.4, 6]} castShadow>
          <sphereGeometry args={[5.4, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial map={tex.tile} color={PALETTE.terracotta[0]} roughness={0.8} />
        </mesh>

        {/* Open train shed over the platform edge. */}
        <mesh position={[0, 12.5, 24]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.3]} castShadow>
          <cylinderGeometry args={[13, 13, 56, 22, 1, true, Math.PI, Math.PI]} />
          <meshStandardMaterial
            color="#5d6a70"
            roughness={0.55}
            metalness={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
        {[-24, -12, 0, 12, 24].map((ox) => (
          <mesh key={ox} geometry={columnGeometry(12.4, 0.55)} position={[ox, 3.4, 30]} castShadow>
            <meshStandardMaterial color="#4d5a62" roughness={0.6} metalness={0.35} />
          </mesh>
        ))}
      </group>

      {/* Trestle out to sea. */}
      <mesh geometry={trestle} castShadow receiveShadow>
        <meshStandardMaterial map={tex.timber} color="#6a563a" roughness={0.95} />
      </mesh>
      {railGeom.map((g, i) => (
        <mesh key={i} geometry={g} castShadow receiveShadow>
          <meshStandardMaterial
            map={i === 0 ? tex.timber : null}
            color={i === 0 ? '#7a6244' : '#6b6f74'}
            roughness={i === 0 ? 0.94 : 0.45}
            metalness={i === 0 ? 0 : 0.6}
          />
        </mesh>
      ))}

      {/* The Puffing Tom, standing at the platform. */}
      {train.map((c, i) => (
        <TrainCar key={i} position={c.position} rotation={c.rotation} kind={c.kind} tex={tex} />
      ))}
    </group>
  )
}
