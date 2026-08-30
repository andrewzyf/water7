/**
 * Falling water — the curtain shader shared by the terrace cascades and the fountain.
 *
 * Water leaving a lip is coherent and glassy; by the time it reaches the pool it has
 * aerated to white. That transition along the fall, plus fast-scrolling stretched
 * streaks that break the sheet into strands, is most of what makes a fall read as
 * moving rather than as a pale ribbon of geometry.
 */
import * as THREE from 'three'
import { waterNormalTexture } from '../textures.js'

export const fallVertexShader = /* glsl */ `
  attribute float fall;
  varying vec2 vUv;
  varying float vFall;
  void main() {
    vUv = uv;
    vFall = fall;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const fallFragmentShader = /* glsl */ `
  uniform sampler2D uRipples;
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uWater;
  uniform vec3 uFoam;
  uniform float uOpacity;

  varying vec2 vUv;
  varying float vFall;

  void main() {
    vec2 uv = vec2(vUv.x * 5.0, vUv.y * 0.7 - uTime * uSpeed);
    float a = texture2D(uRipples, uv).x;
    float b = texture2D(uRipples, uv * vec2(2.3, 0.55) + vec2(0.37, -uTime * uSpeed * 1.5)).y;
    float streak = a * 0.6 + b * 0.5;

    float aeration = smoothstep(0.05, 0.85, vFall);
    vec3 col = mix(uWater, uFoam, aeration * 0.62 + streak * 0.2);

    float strands = smoothstep(0.35, 0.75, streak);
    float alpha = mix(0.62, 0.26 + strands * 0.52, aeration) * uOpacity;
    alpha *= smoothstep(0.0, 0.09, vFall);

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createFallMaterial({ speed = 1.5, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: fallVertexShader,
    fragmentShader: fallFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uRipples: { value: waterNormalTexture() },
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uWater: { value: new THREE.Color('#8fd8dc') },
      uFoam: { value: new THREE.Color('#f4fbfc') },
      uOpacity: { value: opacity },
    },
  })
}
