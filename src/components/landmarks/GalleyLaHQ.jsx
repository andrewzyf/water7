import { useMemo } from 'react'
import * as THREE from 'three'
import { LANDMARKS, polar, DEG, tierById, outwardYaw } from '../../world/config.js'
import { PALETTE } from '../../world/palette.js'
import { archWallGeometry, columnGeometry, balustradeGeometry, stairGeometry, mergeSimple } from '../../world/arch.js'
import { ashlarTexture, plasterTexture, timberTexture, roofTileTexture, windowTexture } from '../../world/textures.js'
import BarrelRoof from '../BarrelRoof.jsx'

/**
 * Galley-La Company headquarters — shipwright HQ, Iceburg's home, and the mayor's
 * office in one building, and the largest house on the island.
 *
 * The references give two distinct structures and this merges both, as the arc does:
 * the broad timber hall carrying the company name across its front, and behind it the
 * tall pale stone block with the round oculus. It stands on the civic terrace at the
 * head of the ceremonial spine, looking down over Dock 1 and the harbour.
 */

function signTexture() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#f0e7d2'
  ctx.fillRect(0, 0, 1024, 256)
  ctx.strokeStyle = '#8a7a5e'
  ctx.lineWidth = 8
  ctx.strokeRect(10, 10, 1004, 236)
  ctx.fillStyle = '#2d3a44'
  ctx.font = 'bold 104px Georgia, "Times New Roman", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('GALLEY-LA', 512, 92)
  ctx.font = 'bold 76px Georgia, "Times New Roman", serif'
  ctx.fillText('COMPANY', 512, 180)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function oculusTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#e8dfc9'
  ctx.fillRect(0, 0, 256, 256)
  ctx.beginPath()
  ctx.arc(128, 128, 104, 0, Math.PI * 2)
  const g = ctx.createLinearGradient(40, 40, 210, 220)
  g.addColorStop(0, '#7f7a9c')
  g.addColorStop(0.5, '#b9b1d0')
  g.addColorStop(1, '#dfe8f2')
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = '#f3ecdb'
  ctx.lineWidth = 14
  ctx.stroke()
  // Radial glazing bars.
  ctx.lineWidth = 7
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(128, 128)
    ctx.lineTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(128, 128, 34, 0, Math.PI * 2)
  ctx.strokeStyle = '#f3ecdb'
  ctx.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export default function GalleyLaHQ() {
  const l = LANDMARKS.galleyLaHQ
  const [x, z] = polar(l.radius, l.bearing)
  const y = tierById(2).y
  const rot = outwardYaw(l.bearing) // facade looks down the slope to the harbour

  const tex = useMemo(() => {
    const ashlar = ashlarTexture(512, 6); ashlar.repeat.set(5, 3)
    const plaster = plasterTexture(); plaster.repeat.set(4, 3)
    const timber = timberTexture(); timber.repeat.set(4, 2)
    const tile = roofTileTexture(); tile.repeat.set(5, 1)
    return { ashlar, plaster, timber, tile, window: windowTexture() }
  }, [])
  const sign = useMemo(signTexture, [])
  const oculus = useMemo(oculusTexture, [])

  // Ground-floor loggia across the front of the timber hall.
  const loggia = useMemo(() => archWallGeometry({
    width: 62, height: 11, depth: 3.0,
    openWidth: 6.0, openHeight: 8.0, count: 7, gap: 2.4,
  }), [])

  // Pilasters and a cornice band on the stone block.
  const pilasters = useMemo(() => {
    const parts = []
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const px = s * (6 + i * 6.4)
        const p = new THREE.BoxGeometry(2.0, 34, 1.2)
        p.translate(px, 17, 14.6)
        parts.push(p)
      }
    }
    const band = new THREE.BoxGeometry(42, 1.8, 30)
    band.translate(0, 34.4, 0)
    parts.push(band)
    const base = new THREE.BoxGeometry(44, 2.6, 32)
    base.translate(0, 1.3, 0)
    parts.push(base)
    return mergeSimple(parts)
  }, [])

  const steps = useMemo(() => stairGeometry(26, 3.2, 8, 6), [])

  const rail = useMemo(() => {
    const parts = []
    for (const s of [-1, 1]) {
      const g = balustradeGeometry(30, 1.5)
      g.translate(s * 40, 0, 22)
      parts.push(g)
    }
    const front = balustradeGeometry(46, 1.5)
    front.translate(0, 0, 36)
    parts.push(front)
    return mergeSimple(parts)
  }, [])

  const windows = useMemo(() => {
    const out = []
    for (let s = 0; s < 3; s++) {
      for (let c = 0; c < 5; c++) {
        out.push([-14 + c * 7, 7 + s * 9.4, 15.3])
      }
    }
    return out
  }, [])

  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      {/* Grounds: a walled forecourt, as befits the most heavily guarded house here. */}
      <mesh position={[0, 0.2, 8]} receiveShadow>
        <boxGeometry args={[92, 0.4, 74]} />
        <meshStandardMaterial map={tex.ashlar} color="#a9a08c" roughness={0.98} />
      </mesh>
      <mesh position={[0, 0.45, 30]} receiveShadow>
        <boxGeometry args={[54, 0.5, 24]} />
        <meshStandardMaterial color={PALETTE.grass} roughness={1} />
      </mesh>
      <mesh geometry={rail} position={[0, 0.4, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={tex.ashlar} color="#cfc6b0" roughness={0.9} />
      </mesh>
      <mesh geometry={steps} position={[0, 0.4, 20]} castShadow receiveShadow>
        <meshStandardMaterial map={tex.ashlar} color="#c8bfa9" roughness={0.94} />
      </mesh>

      {/* --- Timber hall, carrying the company name --- */}
      <group position={[0, 3.6, 12]}>
        <mesh geometry={loggia} castShadow receiveShadow>
          <meshStandardMaterial map={tex.timber} color={PALETTE.galleyLaBlue} roughness={0.86} />
        </mesh>
        <mesh position={[0, 17, -7]} castShadow receiveShadow>
          <boxGeometry args={[62, 12, 20]} />
          <meshStandardMaterial map={tex.timber} color={PALETTE.galleyLaBlue} roughness={0.86} />
        </mesh>
        {/* Signboard. */}
        <mesh position={[0, 17.5, 3.2]}>
          <planeGeometry args={[34, 8.5]} />
          <meshStandardMaterial map={sign} roughness={0.8} />
        </mesh>
        <BarrelRoof
          position={[0, 23, -7]}
          width={62} depth={20} rise={0.4}
          map={tex.tile} color={PALETTE.terracotta[0]}
        />
      </group>

      {/* --- Stone block: Iceburg's residence and the mayor's office --- */}
      <group position={[0, 0, -16]}>
        <mesh position={[0, 18, 0]} castShadow receiveShadow>
          <boxGeometry args={[42, 36, 30]} />
          <meshStandardMaterial map={tex.plaster} color={PALETTE.plaster[3]} roughness={0.9} />
        </mesh>
        <mesh geometry={pilasters} castShadow receiveShadow>
          <meshStandardMaterial map={tex.ashlar} color="#e6dcc6" roughness={0.88} />
        </mesh>
        {windows.map((p, i) => (
          <mesh key={i} position={p}>
            <planeGeometry args={[3.4, 4.2]} />
            <meshStandardMaterial map={tex.window} transparent alphaTest={0.35} roughness={0.5} />
          </mesh>
        ))}
        {/* The round oculus. */}
        <mesh position={[0, 30, 15.4]}>
          <circleGeometry args={[5.6, 40]} />
          <meshStandardMaterial map={oculus} roughness={0.5} metalness={0.12} />
        </mesh>
        {/* Barrel roof. */}
        <BarrelRoof
          position={[0, 36, 0]}
          width={42} depth={30} rise={0.5}
          map={tex.tile} color={PALETTE.terracotta[2]}
        />

        {/* Corner turrets with domes. */}
        {[[-24, -18], [24, -18], [-24, 14], [24, 14]].map(([ox, oz], i) => (
          <group key={i} position={[ox, 0, oz]}>
            <mesh position={[0, 23, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[5.0, 5.6, 46, 20]} />
              <meshStandardMaterial map={tex.plaster} color={PALETTE.plaster[0]} roughness={0.9} />
            </mesh>
            <mesh position={[0, 46.6, 0]} castShadow>
              <cylinderGeometry args={[6.0, 5.2, 1.6, 20]} />
              <meshStandardMaterial map={tex.ashlar} color="#e4dac4" roughness={0.88} />
            </mesh>
            <mesh position={[0, 48, 0]} castShadow>
              <sphereGeometry args={[5.5, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial map={tex.tile} color={PALETTE.terracotta[1]} roughness={0.8} />
            </mesh>
            <mesh position={[0, 54.6, 0]} castShadow>
              <sphereGeometry args={[0.9, 12, 8]} />
              <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.35} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
