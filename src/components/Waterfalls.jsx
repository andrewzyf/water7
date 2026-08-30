import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { TIERS, RADIAL_CANALS, canalWaterY, ISLAND_RADIUS, DEG } from '../world/config.js'
import { canalBearingAt, terraceOuterAt } from '../world/shape.js'
import { waterNormalTexture } from '../world/textures.js'

/**
 * The cascades.
 *
 * Every radial canal crosses four terrace edges on its way down, and each crossing is a
 * 15–30 m drop. These are the falls that pour out of the base arches in the reference
 * art, and they are what makes the island read as *fed* by the fountain at its summit
 * rather than merely decorated with canals.
 *
 * Each fall is three parts: a curtain following a projectile arc off the lip, a foam
 * cap where the water leaves, and a splash disc in the pool below.
 */

const curtainVert = /* glsl */ `
  varying vec2 vUv;
  varying float vFall;   // 0 at the lip, 1 at the pool
  varying vec3 vWorld;
  attribute float fall;
  void main() {
    vUv = uv;
    vFall = fall;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const curtainFrag = /* glsl */ `
  uniform sampler2D uRipples;
  uniform float uTime;
  uniform vec3 uWater;
  uniform vec3 uFoam;

  varying vec2 vUv;
  varying float vFall;
  varying vec3 vWorld;

  void main() {
    // Streaks stretched along the fall and scrolled fast downward.
    vec2 uv = vec2(vUv.x * 5.0, vUv.y * 0.7 - uTime * 1.5);
    float a = texture2D(uRipples, uv).x;
    float b = texture2D(uRipples, uv * vec2(2.3, 0.55) + vec2(0.37, -uTime * 2.3)).y;
    float streak = a * 0.6 + b * 0.5;

    // Water aerates as it falls: coherent and glassy at the lip, white at the bottom.
    float aeration = smoothstep(0.05, 0.85, vFall);
    vec3 col = mix(uWater, uFoam, aeration * 0.62 + streak * 0.2);

    // Break the sheet into strands lower down so it is not a flat ribbon.
    float strands = smoothstep(0.35, 0.75, streak);
    float alpha = mix(0.62, 0.26 + strands * 0.52, aeration);
    // Fade the very top so the curtain melts into the canal surface it leaves.
    alpha *= smoothstep(0.0, 0.09, vFall);

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const splashFrag = /* glsl */ `
  uniform sampler2D uRipples;
  uniform float uTime;
  uniform vec3 uFoam;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;
    // Rings pushing outward from the impact point.
    float ring = sin(d * 9.0 - uTime * 3.4) * 0.5 + 0.5;
    float n = texture2D(uRipples, vUv * 3.0 + vec2(uTime * 0.13, -uTime * 0.11)).x;
    float a = (1.0 - smoothstep(0.25, 1.0, d)) * (0.42 + ring * 0.3 + n * 0.4);
    gl_FragColor = vec4(uFoam, clamp(a, 0.0, 0.92));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** Where every fall on the island is, and how far it drops. */
function collectFalls() {
  const falls = []
  for (let i = 0; i < TIERS.length - 1; i++) {
    const upper = TIERS[i]
    const lower = TIERS[i + 1]
    const yTop = canalWaterY(upper)
    const yBot = canalWaterY(lower)
    for (const ch of RADIAL_CANALS.channels) {
      const rEdge = terraceOuterAt(upper, ch.bearing)
      if (rEdge <= ch.inner || rEdge > ISLAND_RADIUS) continue
      falls.push({
        bearing: canalBearingAt(ch, rEdge),
        radius: rEdge,
        yTop,
        yBot,
        half: ch.halfWidth,
      })
    }
  }
  return falls
}

function buildCurtains(falls) {
  const pos = []
  const uv = []
  const fallAttr = []
  const idx = []
  const STEPS = 14

  for (const f of falls) {
    const drop = f.yTop - f.yBot
    // Projectile arc: horizontal reach grows linearly, the drop with the square of t.
    const reach = Math.min(7.5, 2.4 + drop * 0.16)
    const a = f.bearing * DEG
    const d = [Math.cos(a), Math.sin(a)]
    const p = [-Math.sin(a), Math.cos(a)]
    const base = pos.length / 3

    for (let j = 0; j <= STEPS; j++) {
      const t = j / STEPS
      const r = f.radius - 1.2 + reach * t
      const y = f.yTop - drop * t * t
      // The sheet spreads a little as it falls.
      const half = f.half * (1 + t * 0.22)
      for (let k = -1; k <= 1; k += 2) {
        pos.push(r * d[0] + p[0] * half * k, y, r * d[1] + p[1] * half * k)
        uv.push((k + 1) / 2, t)
        fallAttr.push(t)
      }
    }
    for (let j = 0; j < STEPS; j++) {
      const o = base + j * 2
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('fall', new THREE.Float32BufferAttribute(fallAttr, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

export default function Waterfalls() {
  const falls = useMemo(collectFalls, [])
  const curtainGeo = useMemo(() => buildCurtains(falls), [falls])

  const curtainMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: curtainVert,
    fragmentShader: curtainFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uRipples: { value: waterNormalTexture() },
      uTime: { value: 0 },
      uWater: { value: new THREE.Color('#8fd8dc') },
      uFoam: { value: new THREE.Color('#f4fbfc') },
    },
  }), [])

  const splashMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: splashFrag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uRipples: { value: waterNormalTexture() },
      uTime: { value: 0 },
      uFoam: { value: new THREE.Color('#eef9fb') },
    },
  }), [])

  useFrame(({ clock }) => {
    curtainMat.uniforms.uTime.value = clock.elapsedTime
    splashMat.uniforms.uTime.value = clock.elapsedTime
  })

  const splashes = useMemo(() => falls.map((f) => {
    const drop = f.yTop - f.yBot
    const reach = Math.min(7.5, 2.4 + drop * 0.16)
    const a = f.bearing * DEG
    const r = f.radius - 1.2 + reach
    return {
      key: `${f.bearing.toFixed(2)}-${f.yTop}`,
      pos: [r * Math.cos(a), f.yBot + 0.12, r * Math.sin(a)],
      size: f.half * 4.4,
    }
  }), [falls])

  return (
    <group>
      <mesh geometry={curtainGeo} material={curtainMat} renderOrder={5} frustumCulled={false} />
      {splashes.map((s) => (
        <mesh key={s.key} position={s.pos} rotation={[-Math.PI / 2, 0, 0]} material={splashMat} renderOrder={4}>
          <planeGeometry args={[s.size, s.size]} />
        </mesh>
      ))}
    </group>
  )
}
