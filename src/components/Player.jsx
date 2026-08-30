import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { SPAWN, polar } from '../world/config.js'
import { sampleSurface, canStand } from '../world/nav.js'
import { debugCam } from '../world/debugCamera.js'

const WALK = 3.6
const RUN = 7.6
const EYE = 1.75
const PROBE = 0.65 // horizontal step used for slope testing

/** Is (x, z) inside any building footprint? Tested in each building's own frame. */
function hitsBuilding(x, z, colliders) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i]
    const dx = x - c.x
    const dz = z - c.z
    if (Math.abs(dx) > 24 || Math.abs(dz) > 24) continue
    const lx = dx * c.cos - dz * c.sin
    const lz = dx * c.sin + dz * c.cos
    if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return true
  }
  return false
}

/**
 * Third-person character controller.
 *
 * Collision comes straight from the height field: a move is legal if the destination
 * is not water, not inside a building, and not too steep a rise. The terrace retaining
 * walls fail that slope test and the four ramps pass it, so the city's whole vertical
 * navigation falls out of the terrain definition rather than needing hand-placed
 * volumes. Blocked moves are retried on each axis alone, so you slide along walls
 * instead of sticking to them.
 */
export default function Player({ colliders, playerState }) {
  const { camera, gl } = useThree()
  const body = useRef()
  const keys = useRef({})
  const look = useRef({ yaw: Math.PI * 0.5, pitch: -0.16 })
  const pos = useRef(new THREE.Vector3())
  const facing = useRef(0)
  const camPos = useRef(new THREE.Vector3())

  const spawn = useMemo(() => {
    const [x, z] = polar(SPAWN.radius, SPAWN.bearing)
    return new THREE.Vector3(x, sampleSurface(x, z).y, z)
  }, [])

  useEffect(() => {
    pos.current.copy(spawn)
    camPos.current.set(spawn.x, spawn.y + 8, spawn.z + 12)
  }, [spawn])

  useEffect(() => {
    const down = (e) => {
      keys.current[e.code] = true
      if (e.code === 'Space') e.preventDefault()
    }
    const up = (e) => { keys.current[e.code] = false }
    const move = (e) => {
      if (document.pointerLockElement !== gl.domElement) return
      look.current.yaw -= e.movementX * 0.0022
      look.current.pitch = THREE.MathUtils.clamp(
        look.current.pitch - e.movementY * 0.0019, -0.95, 0.62,
      )
    }
    const click = () => gl.domElement.requestPointerLock()

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('mousemove', move)
    gl.domElement.addEventListener('click', click)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('mousemove', move)
      gl.domElement.removeEventListener('click', click)
    }
  }, [gl])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const k = keys.current
    const { yaw, pitch } = look.current

    // Movement basis from the camera's yaw.
    let ix = 0
    let iz = 0
    if (k.KeyW || k.ArrowUp) iz += 1
    if (k.KeyS || k.ArrowDown) iz -= 1
    if (k.KeyA || k.ArrowLeft) ix -= 1
    if (k.KeyD || k.ArrowRight) ix += 1

    const running = k.ShiftLeft || k.ShiftRight
    const speed = running ? RUN : WALK
    const here = pos.current

    if (ix || iz) {
      const len = Math.hypot(ix, iz)
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
      const dir = fwd.multiplyScalar(iz / len).add(right.multiplyScalar(ix / len))
      facing.current = Math.atan2(dir.x, dir.z)

      const step = speed * dt
      const from = { x: here.x, z: here.z, y: here.y }
      const attempts = [
        [dir.x * step, dir.z * step],
        [dir.x * step, 0],
        [0, dir.z * step],
      ]
      for (const [dx, dz] of attempts) {
        if (dx === 0 && dz === 0) continue
        // Probe slightly ahead of the actual step so slopes are judged consistently
        // regardless of frame rate.
        const scale = PROBE / Math.max(Math.hypot(dx, dz), 1e-6)
        const px = here.x + dx * Math.max(1, scale)
        const pz = here.z + dz * Math.max(1, scale)
        if (hitsBuilding(px, pz, colliders)) continue
        const surf = canStand(from, { x: px, z: pz })
        if (!surf) continue

        const nx = here.x + dx
        const nz = here.z + dz
        if (hitsBuilding(nx, nz, colliders)) continue
        here.x = nx
        here.z = nz
        break
      }
    }

    // Settle onto the surface.
    const s = sampleSurface(here.x, here.z)
    here.y += (s.y - here.y) * Math.min(1, dt * 14)

    if (body.current) {
      body.current.position.set(here.x, here.y + 0.9, here.z)
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

    // Third-person camera: orbit behind the player, lifted clear of the ground.
    const dist = 7.4
    const cx = here.x + Math.sin(yaw) * Math.cos(pitch) * dist
    const cz = here.z + Math.cos(yaw) * Math.cos(pitch) * dist
    const cy = here.y + EYE + Math.sin(-pitch) * dist + 1.4
    const groundAtCam = sampleSurface(cx, cz).y
    const target = new THREE.Vector3(cx, Math.max(cy, groundAtCam + 1.6), cz)
    camPos.current.lerp(target, Math.min(1, dt * 9))
    camera.position.copy(camPos.current)
    camera.lookAt(here.x, here.y + EYE, here.z)

    playerState.current = {
      x: here.x, y: here.y, z: here.z,
      r: Math.hypot(here.x, here.z),
      running,
      onBridge: s.onBridge,
    }
  })

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
      {/* Straw hat, so the character reads at a distance. */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <cylinderGeometry args={[0.62, 0.62, 0.06, 18]} />
        <meshStandardMaterial color="#e8c96a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.74, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.32, 0.24, 16]} />
        <meshStandardMaterial color="#e8c96a" roughness={0.9} />
      </mesh>
      {/* Nose marker so facing is obvious in screenshots. */}
      <mesh position={[0, 1.42, 0.28]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color="#b2543a" />
      </mesh>
    </group>
  )
}
