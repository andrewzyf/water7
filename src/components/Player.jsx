import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { SPAWN, polar } from '../world/config.js'
import { sampleSurface, canStand, MOVE_SUBSTEP } from '../world/nav.js'
import { blocked } from '../world/colliders.js'
import { findLandingSpot } from '../world/boarding.js'
import { debugCam } from '../world/debugCamera.js'

const WALK = 6.0
const RUN = 13.0
const EYE = 1.75
const RADIUS = 0.45      // the walker's shoulder width, for wall clearance
const JUMP_SPEED = 7.4
const GRAVITY = -21
const AIR_CONTROL = 0.75

export const MIN_ZOOM = 3
export const MAX_ZOOM = 420   // far enough out to take in the whole island
const DEFAULT_ZOOM = 8.5
const LOOK_SENSITIVITY = 0.0032

/**
 * Third-person character controller.
 *
 * Collision comes straight from the height field: a move is legal if the destination is
 * not water, not inside anything solid, and not too steep a rise. The terrace retaining
 * walls fail that slope test and the four ramps pass it, so the island's whole vertical
 * navigation falls out of the terrain definition rather than needing authored volumes.
 *
 * Two things matter for it to feel right:
 *
 * - **Test where you land, not ahead of it.** The move is split into substeps of at most
 *   MOVE_SUBSTEP and each is tested at its own destination. Probing a fixed distance
 *   ahead of a much smaller step — which this used to do — puts an invisible wall in
 *   front of every slope and ledge, and makes gentle ground read as unclimbable.
 * - **Slide, don't stick.** A blocked substep is retried on each axis alone, so you run
 *   along a wall instead of stopping dead against it.
 */
export default function Player({ colliders, playerState, active = true, spawnOverride }) {
  const { camera, gl } = useThree()
  const body = useRef()
  const keys = useRef({})
  const look = useRef({ yaw: Math.PI * 0.5, pitch: -0.16 })
  const zoom = useRef(DEFAULT_ZOOM)
  const pos = useRef(new THREE.Vector3())
  const vy = useRef(0)
  const grounded = useRef(true)
  const facing = useRef(0)
  const camPos = useRef(new THREE.Vector3())
  const dragging = useRef(false)
  const jumpQueued = useRef(false)
  // Rendered height, lagging the physics height. Stair treads step 0.38 m at a time and
  // following them exactly makes the camera judder up every flight.
  const smoothY = useRef(0)

  const spawn = useMemo(() => {
    const [x, z] = polar(SPAWN.radius, SPAWN.bearing)
    return new THREE.Vector3(x, sampleSurface(x, z).y, z)
  }, [])

  useEffect(() => {
    const p = spawnOverride
      ? new THREE.Vector3(spawnOverride.x, spawnOverride.y, spawnOverride.z)
      : spawn
    pos.current.copy(p)
    smoothY.current = p.y
    vy.current = 0
    camPos.current.set(p.x, p.y + 8, p.z + 12)
  }, [spawn, spawnOverride])

  useEffect(() => {
    const down = (e) => {
      keys.current[e.code] = true
      if (e.code === 'Space') {
        e.preventDefault()
        // Buffered rather than sampled: a quick tap can begin and end entirely between
        // two frames, and a jump that silently does nothing feels broken.
        if (!e.repeat) jumpQueued.current = true
      }
    }
    const up = (e) => { keys.current[e.code] = false }

    const move = (e) => {
      // Look works either with the pointer locked, or by dragging with the mouse held —
      // pointer lock is fiddly to get into and out of, and dragging always works.
      const locked = document.pointerLockElement === gl.domElement
      if (!locked && !dragging.current) return
      look.current.yaw -= e.movementX * LOOK_SENSITIVITY
      look.current.pitch = THREE.MathUtils.clamp(
        look.current.pitch - e.movementY * LOOK_SENSITIVITY, -1.15, 0.95,
      )
    }

    const mouseDown = (e) => { if (e.button === 0) dragging.current = true }
    const mouseUp = () => { dragging.current = false }
    const click = () => {
      if (document.pointerLockElement !== gl.domElement) gl.domElement.requestPointerLock()
    }
    const wheel = (e) => {
      e.preventDefault()
      // Proportional, so zooming stays responsive whether you are up close or far out.
      const f = Math.exp(e.deltaY * 0.0012)
      zoom.current = THREE.MathUtils.clamp(zoom.current * f, MIN_ZOOM, MAX_ZOOM)
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', mouseUp)
    gl.domElement.addEventListener('mousedown', mouseDown)
    gl.domElement.addEventListener('click', click)
    gl.domElement.addEventListener('wheel', wheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', mouseUp)
      gl.domElement.removeEventListener('mousedown', mouseDown)
      gl.domElement.removeEventListener('click', click)
      gl.domElement.removeEventListener('wheel', wheel)
    }
  }, [gl])

  useFrame((_, rawDelta) => {
    if (!active) return
    const dt = Math.min(rawDelta, 0.05)
    const k = keys.current
    const { yaw, pitch } = look.current
    const here = pos.current

    let ix = 0
    let iz = 0
    if (k.KeyW || k.ArrowUp) iz += 1
    if (k.KeyS || k.ArrowDown) iz -= 1
    if (k.KeyA || k.ArrowLeft) ix -= 1
    if (k.KeyD || k.ArrowRight) ix += 1

    const running = k.ShiftLeft || k.ShiftRight
    const airborne = !grounded.current
    const speed = (running ? RUN : WALK) * (airborne ? AIR_CONTROL : 1)

    if ((jumpQueued.current || k.Space) && grounded.current) {
      vy.current = JUMP_SPEED
      grounded.current = false
    }
    jumpQueued.current = false

    if (ix || iz) {
      const len = Math.hypot(ix, iz)
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
      const dir = fwd.multiplyScalar(iz / len).add(right.multiplyScalar(ix / len))
      facing.current = Math.atan2(dir.x, dir.z)

      // Split the frame's travel into substeps no longer than MOVE_SUBSTEP, which is
      // what makes the slope limit mean the same thing at any frame rate.
      let remaining = speed * dt
      while (remaining > 1e-4) {
        const step = Math.min(remaining, MOVE_SUBSTEP)
        remaining -= step
        const dx = dir.x * step
        const dz = dir.z * step

        let moved = false
        for (const [ax, az] of [[dx, dz], [dx, 0], [0, dz]]) {
          if (ax === 0 && az === 0) continue
          const nx = here.x + ax
          const nz = here.z + az
          if (blocked(nx, nz, colliders, RADIUS)) continue
          // In the air you may pass over water — that is what jumping a canal means.
          const surf = canStand({ x: here.x, z: here.z, y: here.y }, { x: nx, z: nz },
            { allowWater: airborne })
          if (!surf) continue
          here.x = nx
          here.z = nz
          if (!airborne) here.y = surf.y
          moved = true
          break
        }
        if (!moved) break
      }
    }

    // Gravity and landing.
    const s = sampleSurface(here.x, here.z, here.y)
    if (grounded.current) {
      here.y += (s.y - here.y) * Math.min(1, dt * 18)
      if (vy.current > 0) { here.y += vy.current * dt; grounded.current = false }
    } else {
      vy.current += GRAVITY * dt
      here.y += vy.current * dt
      if (here.y <= s.y) {
        here.y = s.y
        vy.current = 0
        grounded.current = true
        // Landing in a canal is never a stuck state: step out onto the nearest quay.
        if (s.water) {
          const land = findLandingSpot({ x: here.x, z: here.z }, 40)
          if (land) { here.x = land.x; here.z = land.z; here.y = land.y }
        }
      }
    }

    // Smooth the *rendered* height while physics keeps the exact one, so climbing a
    // stair reads as a walk up rather than a series of jolts. Snapped when falling
    // fast, so a real drop still lands hard.
    const lag = grounded.current ? Math.min(1, dt * 11) : 1
    smoothY.current += (here.y - smoothY.current) * lag
    const drawY = smoothY.current

    if (body.current) {
      body.current.position.set(here.x, drawY + 0.9, here.z)
      body.current.rotation.y = facing.current
    }

    if (debugCam.active) {
      camera.position.set(...debugCam.pos)
      camera.lookAt(...debugCam.look)
      playerState.current = {
        x: here.x, y: here.y, z: here.z,
        r: Math.hypot(here.x, here.z), running, onBridge: s.onBridge,
      }
      return
    }

    // Third-person camera: orbit behind the player at the current zoom, lifted clear of
    // the ground so pulling right out gives a view over the island rather than into it.
    const dist = zoom.current
    const cx = here.x + Math.sin(yaw) * Math.cos(pitch) * dist
    const cz = here.z + Math.cos(yaw) * Math.cos(pitch) * dist
    const cy = drawY + EYE + Math.sin(-pitch) * dist + dist * 0.16
    const groundAtCam = sampleSurface(cx, cz, here.y).y
    const target = new THREE.Vector3(cx, Math.max(cy, groundAtCam + 2.0), cz)
    camPos.current.lerp(target, Math.min(1, dt * 12))
    camera.position.copy(camPos.current)
    camera.lookAt(here.x, drawY + EYE, here.z)

    playerState.current = {
      x: here.x, y: here.y, z: here.z,
      r: Math.hypot(here.x, here.z),
      running,
      onBridge: s.onBridge,
      airborne: !grounded.current,
      zoom: zoom.current,
    }
  })

  if (!active) return null
  return (
    <group ref={body}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.34, 1.0, 6, 12]} />
        <meshStandardMaterial color="#d94f3d" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.42, 0]} castShadow>
        <sphereGeometry args={[0.29, 16, 12]} />
        <meshStandardMaterial color="#f0c9a4" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <cylinderGeometry args={[0.62, 0.62, 0.06, 18]} />
        <meshStandardMaterial color="#e8c96a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.74, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.32, 0.24, 16]} />
        <meshStandardMaterial color="#e8c96a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.42, 0.28]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color="#b2543a" />
      </mesh>
    </group>
  )
}
