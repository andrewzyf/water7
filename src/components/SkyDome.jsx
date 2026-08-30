import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * The sky.
 *
 * A physical sky model bleaches its horizon into a white band that swallows the sea,
 * and it cannot give us clouds — and a deep blue sky stacked with white cumulus is as
 * much a part of how Water 7 looks as the terracotta roofs are.
 *
 * So: a gradient dome with procedural cloud layers projected onto a flat plane
 * overhead. Projecting onto a plane rather than the dome makes the clouds converge
 * toward the horizon the way real ones do, instead of sitting on the sphere like paint.
 */

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    // Translation stripped from the view matrix, so the dome never moves relative to
    // the camera and can be far smaller than the far plane.
    vec4 pos = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
    gl_Position = pos.xyww; // force to the far plane
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uCloud;
  uniform vec3 uCloudShade;
  uniform float uTime;
  uniform float uCover;

  varying vec3 vDir;

  float hash(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);

    // Gradient, deepest overhead.
    vec3 sky = mix(uHorizon, uZenith, pow(up, 0.55));

    // A warm bloom around the sun, kept modest so it does not bleach the horizon.
    float sun = max(dot(d, normalize(uSunDir)), 0.0);
    sky += uSunColor * pow(sun, 26.0) * 0.6;
    sky += uSunColor * pow(sun, 4.0) * 0.06;

    // Clouds on a plane overhead: they crowd together toward the horizon, as real ones
    // do, instead of sitting evenly on the dome.
    if (d.y > 0.01) {
      // Straight plane projection. Clamping the divisor to tame the horizon stretch
      // collapses the whole near-horizon band onto one noise sample and the clouds
      // disappear, so the stretch is accepted and the fade below hides its worst.
      vec2 uv = d.xz / d.y * 0.045;
      vec2 drift = vec2(uTime * 0.0035, uTime * 0.0018);
      float base = fbm(uv * 0.8 + drift);
      float detail = fbm(uv * 2.4 - drift * 1.7);
      // Weighted toward the low-frequency shape: leaning on the detail octaves gives
      // torn wisps, and these skies want distinct heaped cumulus.
      float mask = base * 0.90 + detail * 0.30;

      // A tight ramp keeps the edges crisp; a wide one turns them to fog.
      float cloud = smoothstep(uCover, uCover + 0.14, mask);
      // Fade out near the horizon, where the projection stretches to infinity.
      cloud *= smoothstep(0.010, 0.085, d.y);

      // Shade the undersides so they read as volumes.
      float lit = smoothstep(0.30, 0.72, base * 0.6 + detail * 0.6);
      vec3 body = mix(uCloudShade, uCloud, lit);
      sky = mix(sky, body, cloud * 0.94);
    }

    gl_FragColor = vec4(sky, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export default function SkyDome({ sunDirection }) {
  const matRef = useRef()

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uZenith: { value: new THREE.Color('#1f7ac6') },
      uHorizon: { value: new THREE.Color('#cbe9f6') },
      uSunDir: { value: (sunDirection ?? new THREE.Vector3(-0.6, 0.5, 0.5)).clone() },
      uSunColor: { value: new THREE.Color('#fff4dd') },
      uCloud: { value: new THREE.Color('#ffffff') },
      uCloudShade: { value: new THREE.Color('#a8c4da') },
      uTime: { value: 0 },
      uCover: { value: 0.47 },
    },
  }), [sunDirection])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <mesh material={material} ref={matRef} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 24]} />
    </mesh>
  )
}
