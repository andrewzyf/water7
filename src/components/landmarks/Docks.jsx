import { useMemo } from 'react'
import * as THREE from 'three'
import { DOCKS, polar, DEG, tierById, outwardYaw } from '../../world/config.js'
import { DOCK_BASIN } from '../../world/terrain.js'
import { PALETTE } from '../../world/palette.js'
import { archWallGeometry, mergeSimple } from '../../world/arch.js'
import { ashlarTexture, plasterTexture, timberTexture, roofTileTexture } from '../../world/textures.js'
import BarrelRoof from '../BarrelRoof.jsx'

/**
 * The seven Galley-La dry docks.
 *
 * Canon gives us one clear fact to build from: each dock is entered "through a towering
 * door with its number on it". So the gate is the piece that matters — a real arched
 * opening you can see through, carrying its numeral, with the shipyard behind it.
 *
 * Dock 1 is the flagship: the widest gate, the heaviest gantry, and a hull on the
 * stocks. The other six reuse its vocabulary at varied scale, since the series never
 * shows them.
 */

/** Digits drawn as a canvas texture for the gate plaques. */
const numeralCache = new Map()
function numeralTexture(n) {
  if (numeralCache.has(n)) return numeralCache.get(n)
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#efe4cc'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = '#8d7f66'
  ctx.lineWidth = 10
  ctx.strokeRect(12, 12, 232, 232)
  ctx.fillStyle = '#2f3a42'
  ctx.font = 'bold 190px Georgia, "Times New Roman", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), 128, 140)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  numeralCache.set(n, t)
  return t
}

/** A lattice gantry straddling the basin, in the manner of Dock 1's reference art. */
function gantryGeometry(span, height, heavy) {
  const parts = []
  const legR = heavy ? 1.5 : 1.1
  for (const sx of [-1, 1]) {
    const x = sx * span * 0.5
    const leg = new THREE.BoxGeometry(legR * 2, height, legR * 2)
    leg.translate(x, height / 2, 0)
    parts.push(leg)
    // Cross-bracing up each leg.
    for (let i = 0; i < 5; i++) {
      const y = height * (0.14 + i * 0.17)
      const br = new THREE.BoxGeometry(legR * 3.4, 0.5, 0.5)
      br.translate(x, y, 0)
      parts.push(br)
    }
  }
  // Top chord plus a lattice web.
  const top = new THREE.BoxGeometry(span * 1.16, 1.7, 2.0)
  top.translate(0, height, 0)
  parts.push(top)
  const lower = new THREE.BoxGeometry(span * 1.02, 1.0, 1.5)
  lower.translate(0, height - 4.2, 0)
  parts.push(lower)
  const bays = 9
  for (let i = 0; i <= bays; i++) {
    const x = -span * 0.5 + (span / bays) * i
    const d = new THREE.BoxGeometry(0.42, 4.4, 0.9)
    d.rotateZ(i % 2 ? 0.42 : -0.42)
    d.translate(x, height - 2.1, 0)
    parts.push(d)
  }
  return mergeSimple(parts)
}

/** Timber stacks, keel blocks and staging on the basin floor. */
function yardClutterGeometry(width, rng) {
  const parts = []
  for (let i = 0; i < 3; i++) {
    const blk = new THREE.BoxGeometry(width * 0.46, 2.4, 5)
    blk.translate(0, 1.2, -14 + i * 14)
    parts.push(blk)
  }
  for (let i = 0; i < 7; i++) {
    const s = 1 + ((i * 7) % 3) * 0.4
    const stack = new THREE.BoxGeometry(7 * s, 1.8, 2.4)
    stack.translate(
      (i % 2 ? 1 : -1) * width * (0.3 + (i % 3) * 0.06),
      0.9 + ((i * 3) % 2) * 1.9,
      -20 + i * 6,
    )
    parts.push(stack)
  }
  return mergeSimple(parts)
}

/** A hull on the stocks — Dock 1 only. */
function hullGeometry(len, beam, depth) {
  const parts = []
  const ribs = 13
  for (let i = 0; i < ribs; i++) {
    const t = i / (ribs - 1)
    // Fine at the ends, full amidships.
    const w = beam * Math.sin(Math.PI * (0.14 + t * 0.72))
    const rib = new THREE.TorusGeometry(w * 0.5, 0.28, 6, 14, Math.PI)
    rib.rotateZ(Math.PI)
    rib.rotateY(Math.PI / 2)
    rib.translate(0, depth * 0.5, -len / 2 + len * t)
    parts.push(rib)
  }
  const keel = new THREE.BoxGeometry(0.8, 0.9, len)
  keel.translate(0, depth * 0.5, 0)
  parts.push(keel)
  // Planking already laid over the after third.
  const planked = new THREE.CylinderGeometry(beam * 0.46, beam * 0.3, len * 0.34, 14, 1, true, 0, Math.PI)
  planked.rotateZ(Math.PI / 2)
  planked.rotateY(Math.PI / 2)
  planked.translate(0, depth * 0.52, -len * 0.3)
  parts.push(planked)
  return mergeSimple(parts)
}

function Dock({ dock, tex }) {
  const a = dock.bearing * DEG
  // Local +Z faces the basin and the open sea, so the numbered gate is read from
  // the water — which is the direction a ship arrives from.
  const rot = outwardYaw(dock.bearing)
  const half = dock.width / 2
  const flagship = dock.n === 1
  const tier0 = tierById(0)
  const gateH = flagship ? 30 : 21 + (dock.n % 3) * 2.5

  const [gx, gz] = polar(DOCK_BASIN.innerR - 5, dock.bearing)
  const [cx, cz] = polar((DOCK_BASIN.innerR + DOCK_BASIN.outerR) / 2, dock.bearing)
  const [sx, sz] = polar(DOCK_BASIN.sillR + 2, dock.bearing)

  const gate = useMemo(() => archWallGeometry({
    width: dock.width + 9,
    height: gateH,
    depth: 4.5,
    openWidth: dock.width * 0.62,
    openHeight: gateH * 0.72,
  }), [dock.width, gateH])

  const gantry = useMemo(
    () => gantryGeometry(dock.width * 1.04, flagship ? 34 : 25, flagship),
    [dock.width, flagship],
  )
  const clutter = useMemo(() => yardClutterGeometry(dock.width, dock.n), [dock.width, dock.n])
  const hull = useMemo(() => (flagship ? hullGeometry(46, 15, 9) : null), [flagship])

  return (
    <group>
      {/* Caisson sill holding the sea out of the drained basin. */}
      <mesh position={[sx, 1.0, sz]} rotation={[0, rot, 0]} castShadow receiveShadow>
        <boxGeometry args={[dock.width + 14, 12, 8]} />
        <meshStandardMaterial map={tex.ashlar} color={PALETTE.ashlarDark} roughness={0.95} />
      </mesh>

      {/* The numbered gate at the head of the dock. */}
      <group position={[gx, tier0.y, gz]} rotation={[0, rot, 0]}>
        <mesh geometry={gate} castShadow receiveShadow>
          <meshStandardMaterial map={tex.plaster} color={PALETTE.plaster[1]} roughness={0.9} />
        </mesh>
        {/* Cornice and tiled cap. */}
        <mesh position={[0, gateH + 1.1, 0]} castShadow>
          <boxGeometry args={[dock.width + 12, 2.2, 6.4]} />
          <meshStandardMaterial map={tex.plaster} color="#efe6d2" roughness={0.85} />
        </mesh>
        {/* Depth must match the gate wall (4.5), not the cornice: a vault longer than
            the wall is deep pushes its end caps proud and shows the whole disc. Rise is
            shallow because this is a capping roof over an 80 m gate, not a dome. */}
        <BarrelRoof
          position={[0, gateH + 2.2, 0]}
          width={dock.width + 12} depth={4.4} rise={0.14}
          map={tex.tile} color={PALETTE.terracotta[0]}
        />
        {/* Numeral plaque, on the face you read from the water. */}
        <mesh position={[0, gateH * 0.86, 2.4]}>
          <planeGeometry args={[7.2, 7.2]} />
          <meshStandardMaterial map={numeralTexture(dock.n)} roughness={0.8} />
        </mesh>
      </group>

      {/* Yard: gantry, staging and stock on the basin floor. */}
      <group position={[cx, DOCK_BASIN.floorY, cz]} rotation={[0, rot, 0]}>
        <mesh geometry={gantry} castShadow receiveShadow>
          <meshStandardMaterial color={PALETTE.iron} roughness={0.66} metalness={0.4} />
        </mesh>
        <mesh geometry={clutter} castShadow receiveShadow>
          <meshStandardMaterial map={tex.timber} color={PALETTE.timber} roughness={0.95} />
        </mesh>
        {hull && (
          <mesh geometry={hull} position={[0, 2.4, 0]} castShadow receiveShadow>
            <meshStandardMaterial map={tex.timber} color="#9a7549" roughness={0.9} />
          </mesh>
        )}
      </group>

      {/* Shed lean-tos along the basin rim. */}
      {[-1, 1].map((sgn) => {
        const [hx, hz] = polar(DOCK_BASIN.innerR + 12, dock.bearing + sgn * (half + 11) / dock.radius / DEG)
        return (
          <group key={sgn} position={[hx, tier0.y, hz]} rotation={[0, rot, 0]}>
            <mesh position={[0, 4.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[13, 8.4, 16]} />
              <meshStandardMaterial map={tex.plaster} color={PALETTE.plaster[4]} roughness={0.9} />
            </mesh>
            <BarrelRoof
              position={[0, 8.4, 0]}
              width={13} depth={16} rise={0.6}
              map={tex.tile} color={PALETTE.terracotta[2]}
            />
          </group>
        )
      })}
    </group>
  )
}

export default function Docks() {
  const tex = useMemo(() => {
    const ashlar = ashlarTexture(512, 6)
    ashlar.repeat.set(4, 1)
    const plaster = plasterTexture()
    plaster.repeat.set(4, 2)
    const timber = timberTexture()
    timber.repeat.set(2, 1)
    const tile = roofTileTexture()
    tile.repeat.set(3, 1)
    return { ashlar, plaster, timber, tile }
  }, [])

  return (
    <group>
      {DOCKS.map((d) => <Dock key={d.n} dock={d} tex={tex} />)}
    </group>
  )
}
