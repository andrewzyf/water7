/**
 * Water shader — one material for the sea, the canals and the fountain pools.
 *
 * Two ideas do most of the work:
 *
 * 1. **Per-vertex flow.** Each vertex carries a `flow` direction, so the same material
 *    makes the sea drift, the radial canals run outward and downward toward the sea,
 *    and the ring canals ease around the island. The surface normal is sampled from a
 *    ripple map scrolled *along* that direction, in two half-cycle-offset phases
 *    cross-faded against each other — the standard trick that stops flowing water from
 *    visibly stretching and snapping back.
 *
 * 2. **Per-vertex bank distance.** `edge` runs 0 at the centre of a channel to 1 at its
 *    bank, which drives foam against the quay walls and lets the colour deepen toward
 *    the middle. Canals read as cut into stone rather than painted on it.
 */
import * as THREE from 'three'
import { waterNormalTexture } from '../textures.js'

const vertexShader = /* glsl */ `
  attribute vec2 flow;
  attribute float edge;

  uniform float uTime;
  uniform float uWaveAmp;
  uniform float uWaveScale;

  varying vec3 vWorld;
  varying vec2 vFlow;
  varying float vEdge;
  varying vec3 vNormalW;

  // Two crossed swells. Enough for an open sea read at this scale; the fine detail
  // comes from the scrolled ripple normal in the fragment stage.
  float swell(vec2 p, float t) {
    return sin(p.x * uWaveScale + t * 0.9) * 0.6
         + sin((p.y * 0.83 + p.x * 0.28) * uWaveScale + t * 1.27) * 0.4;
  }

  void main() {
    vec3 pos = position;
    vec4 world = modelMatrix * vec4(pos, 1.0);

    float h = 0.0;
    if (uWaveAmp > 0.0001) {
      h = swell(world.xz, uTime) * uWaveAmp;
      // Analytic-ish normal from finite differences of the same swell.
      float e = 1.5;
      float hx = swell(world.xz + vec2(e, 0.0), uTime) * uWaveAmp;
      float hz = swell(world.xz + vec2(0.0, e), uTime) * uWaveAmp;
      vNormalW = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
    } else {
      vNormalW = vec3(0.0, 1.0, 0.0);
    }
    world.y += h;

    vWorld = world.xyz;
    vFlow = flow;
    vEdge = edge;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uRipples;
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uHorizonColor;
  uniform float uFlowSpeed;
  uniform float uRippleScale;
  uniform float uFoam;
  uniform float uOpacity;

  varying vec3 vWorld;
  varying vec2 vFlow;
  varying float vEdge;
  varying vec3 vNormalW;

  vec3 rippleNormal(vec2 uv, vec2 dir, float t) {
    // Cross-fade two scroll phases half a cycle apart so the texture never stretches
    // far enough for the smear to become visible.
    float phase = fract(t);
    vec2 a = uv - dir * phase;
    vec2 b = uv - dir * fract(t + 0.5);
    vec3 na = texture2D(uRipples, a).xyz * 2.0 - 1.0;
    vec3 nb = texture2D(uRipples, b).xyz * 2.0 - 1.0;
    float w = abs(0.5 - phase) * 2.0;
    return normalize(mix(na, nb, w));
  }

  void main() {
    vec2 uv = vWorld.xz * uRippleScale;
    float t = uTime * uFlowSpeed;
    vec2 dir = vFlow;

    vec3 n1 = rippleNormal(uv, dir * 0.5, t);
    vec3 n2 = rippleNormal(uv * 2.3 + 17.0, dir * 0.85, t * 1.6);
    vec3 nT = normalize(n1 * 0.65 + n2 * 0.45);

    // Ripple normal is tangent-space with +Z up; the surface is horizontal, so it maps
    // onto the world with Y and Z swapped.
    vec3 N = normalize(vNormalW + vec3(nT.x, 0.0, nT.y) * 0.85);

    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.2);

    // Depth: middle of a channel is deeper than its banks; open sea is deep throughout.
    float depth = 1.0 - vEdge;
    vec3 base = mix(uShallow, uDeep, clamp(depth, 0.0, 1.0));

    // Sky reflection, biased to the horizon at grazing angles.
    vec3 R = reflect(-V, N);
    vec3 sky = mix(uHorizonColor, uSkyColor, clamp(R.y * 1.4, 0.0, 1.0));
    vec3 col = mix(base, sky, clamp(fres * 1.15, 0.0, 0.9));

    // Sun glitter.
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 220.0);
    col += uSunColor * spec * 2.6;
    float sheen = pow(max(dot(N, H), 0.0), 26.0);
    col += uSunColor * sheen * 0.16;

    // Foam: against the banks, and where the ripple crests pile up.
    float bank = smoothstep(0.88, 1.0, vEdge) * uFoam;
    float crest = smoothstep(0.68, 0.97, nT.y) * uFoam * 0.22;
    float foam = clamp(bank + crest, 0.0, 1.0);
    col = mix(col, vec3(0.94, 0.97, 0.98), foam * 0.7);

    gl_FragColor = vec4(col, mix(uOpacity, 1.0, foam * 0.8));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/**
 * @param {object} opts
 * @param {number} opts.waveAmp   vertical swell in metres (0 for canals)
 * @param {number} opts.flowSpeed how fast the ripple map scrolls along `flow`
 * @param {number} opts.foam      0..1 foam strength at the banks
 */
export function createWaterMaterial({
  waveAmp = 0,
  waveScale = 0.02,
  flowSpeed = 0.09,
  rippleScale = 0.035,
  foam = 1.0,
  opacity = 0.9,
  shallow = '#4fb8ad',
  deep = '#12525f',
} = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uRipples: { value: waterNormalTexture() },
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(shallow) },
      uDeep: { value: new THREE.Color(deep) },
      uSunDir: { value: new THREE.Vector3(-0.62, 0.5, 0.45).normalize() },
      uSunColor: { value: new THREE.Color('#fff1d6') },
      uSkyColor: { value: new THREE.Color('#7fc0e2') },
      uHorizonColor: { value: new THREE.Color('#d5e8f0') },
      uWaveAmp: { value: waveAmp },
      uWaveScale: { value: waveScale },
      uFlowSpeed: { value: flowSpeed },
      uRippleScale: { value: rippleScale },
      uFoam: { value: foam },
      uOpacity: { value: opacity },
    },
  })
}
