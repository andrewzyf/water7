import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { boatGeometry } from '../world/boatGeometry.js'
import { isWaterAt, heightAt } from '../world/terrain.js'
import { waterLevelAt, bearingOf } from '../world/terrain.js'
import { timberTexture } from '../world/textures.js'
import { debugCam } from '../world/debugCamera.js'

/**
 * The player's boat.
 *
 * Steer and throttle only — no combat, no damage, nothing to fail at. Water 7's streets
 * are canals, so being able to leave the quay and run the ring canal or the open sea is
 * the other half of exploring the place.
 *
 * Water is not one level here: each terrace holds its canals at its own height, so the
 * boat floats at whatever level the water under it happens to be, and it simply will not
 * cross onto dry land — the same height field that stops the player walking into a canal
 * stops the boat sailing out of one.
 */

const MAX_SPEED = 15
const REVERSE_SPEED = 5
const ACCEL = 7
const DRAG = 0.9
const TURN_RATE = 1.05

export default function PlayerBoat({ active, onExit, spawn, playerState }) {
  const { camera, gl } = useThree()
  const hull = useRef()
  const keys = useRef({})
  const look = useRef({ yaw: 0, pitch: -0.2 })
  const state = useRef({ x: 0, z: 0, y: 0, heading: 0, speed: 0 })
  const camPos = useRef(new THREE.Vector3())
  const geo = useMemo(() => boatGeometry({ length: 8.2, beam: 2.6, depth: 1.2 }), [])
  const timber = useMemo(() => {
    const t = timberTexture()
    t.repeat.set(2, 1)
    return t
  }, [])

  useEffect(() => {
    if (!active || !spawn) return
    state.current.x = spawn.x
    state.current.z = spawn.z
    state.current.y = waterLevelAt(Math.hypot(spawn.x, spawn.z), bearingOf(spawn.x, spawn.z))
    state.current.heading = spawn.heading ?? 0
    state.current.speed = 0
    look.current.yaw = spawn.heading ?? 0
  }, [active, spawn])

  useEffect(() => {
    const down = (e) => { keys.current[e.code] = true }
    const up = (e) => { keys.current[e.code] = false }
    const move = (e) => {
      if (!active) return
      if (document.pointerLockElement !== gl.domElement) return
      look.current.yaw -= e.movementX * 0.0022
      look.current.pitch = THREE.MathUtils.clamp(
        look.current.pitch - e.movementY * 0.0019, -0.9, 0.5,
      )
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('mousemove', move)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('mousemove', move)
    }
  }, [active, gl])

  useFrame(({ clock }, rawDelta) => {
    if (!active) return
    const dt = Math.min(rawDelta, 0.05)
    const k = keys.current
    const s = state.current

    // Throttle.
    const fwd = (k.KeyW || k.ArrowUp) ? 1 : (k.KeyS || k.ArrowDown) ? -1 : 0
    if (fwd > 0) s.speed = Math.min(MAX_SPEED, s.speed + ACCEL * dt)
    else if (fwd < 0) s.speed = Math.max(-REVERSE_SPEED, s.speed - ACCEL * dt)
    else s.speed *= Math.pow(DRAG, dt * 60 / 60 + dt * 2)

    // Rudder only bites when making way, as a boat's does.
    const turn = (k.KeyA || k.ArrowLeft) ? 1 : (k.KeyD || k.ArrowRight) ? -1 : 0
    const bite = THREE.MathUtils.clamp(Math.abs(s.speed) / 5, 0, 1)
    s.heading += turn * TURN_RATE * bite * dt * Math.sign(s.speed || 1)

    // Advance, refusing to leave the water. Each axis is retried alone so the hull
    // slides along a quay wall instead of stopping dead against it — canals are narrow
    // and a boat that sticks to the first stone it touches is miserable to steer.
    const dx = Math.sin(s.heading) * s.speed * dt
    const dz = Math.cos(s.heading) * s.speed * dt
    if (isWaterAt(s.x + dx, s.z + dz)) {
      s.x += dx
      s.z += dz
    } else if (isWaterAt(s.x + dx, s.z)) {
      s.x += dx
      s.speed *= 0.985
    } else if (isWaterAt(s.x, s.z + dz)) {
      s.z += dz
      s.speed *= 0.985
    } else {
      s.speed *= 0.55
    }

    const r = Math.hypot(s.x, s.z)
    const targetY = waterLevelAt(r, bearingOf(s.x, s.z))
    s.y += (targetY - s.y) * Math.min(1, dt * 5)

    const t = clock.elapsedTime
    if (hull.current) {
      hull.current.position.set(s.x, s.y + 0.15 + Math.sin(t * 1.4) * 0.1, s.z)
      hull.current.rotation.set(
        Math.sin(t * 1.1) * 0.03,
        s.heading,
        Math.cos(t * 0.9) * 0.035 - turn * 0.09 * bite,
      )
    }

    playerState.current = {
      x: s.x, y: s.y, z: s.z, r,
      running: Math.abs(s.speed) > 8,
      onBridge: false,
      inBoat: true,
      speed: s.speed,
    }

    if (debugCam.active) {
      camera.position.set(...debugCam.pos)
      camera.lookAt(...debugCam.look)
      return
    }

    const { yaw, pitch } = look.current
    const dist = 13
    const cx = s.x + Math.sin(yaw) * Math.cos(pitch) * dist
    const cz = s.z + Math.cos(yaw) * Math.cos(pitch) * dist
    const cy = s.y + 4.2 + Math.sin(-pitch) * dist
    const ground = heightAt(cx, cz)
    camPos.current.lerp(new THREE.Vector3(cx, Math.max(cy, ground + 2.2), cz), Math.min(1, dt * 6))
    camera.position.copy(camPos.current)
    camera.lookAt(s.x, s.y + 1.6, s.z)
  })

  if (!active) return null
  return (
    <group ref={hull}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial map={timber} color="#8a6a45" roughness={0.86} side={THREE.DoubleSide} />
      </mesh>
      {/* Awning over the after thwart. */}
      <mesh position={[0, 2.0, -1.2]} castShadow>
        <boxGeometry args={[2.8, 0.14, 3.2]} />
        <meshStandardMaterial color="#c4543f" roughness={0.85} />
      </mesh>
      {[[-1.2, -2.7], [1.2, -2.7], [-1.2, 0.3], [1.2, 0.3]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.2, pz]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 1.7, 6]} />
          <meshStandardMaterial color="#5f4930" roughness={0.9} />
        </mesh>
      ))}
      {/* A lamp on the bow, because Water 7 is a city of lanterns. */}
      <mesh position={[0, 1.3, 3.4]}>
        <boxGeometry args={[0.45, 0.6, 0.45]} />
        <meshStandardMaterial emissive="#ffd89a" emissiveIntensity={1.2} roughness={0.3} />
      </mesh>
    </group>
  )
}
