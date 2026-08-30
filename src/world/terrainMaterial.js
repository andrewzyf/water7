/**
 * Triplanar terrain material.
 *
 * The island is a height field with near-vertical retaining walls and canal sides, so a
 * flat top-down projection smears badly exactly where the eye goes — the stonework
 * lining every canal. Triplanar sampling projects from all three axes and blends by the
 * surface normal, which keeps the courses crisp on a vertical face and the paving crisp
 * on a horizontal one.
 *
 * Two materials are blended by slope: cobbled paving where it is walkable, coursed
 * ashlar where it is a wall. That single rule is also what the collision system uses to
 * decide what you can climb, so the island *looks* the way it *behaves*.
 */
import * as THREE from 'three'
import { cobbleTexture, ashlarTexture } from './textures.js'

export function createTerrainMaterial() {
  const paving = cobbleTexture()
  const wall = ashlarTexture(512, 7)
  paving.repeat.set(1, 1)
  wall.repeat.set(1, 1)

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  })

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPaving = { value: paving }
    shader.uniforms.uWall = { value: wall }
    shader.uniforms.uPavingScale = { value: 0.055 }
    shader.uniforms.uWallScale = { value: 0.085 }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
      `)
      .replace('#include <worldpos_vertex>', `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
      `)

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        uniform sampler2D uPaving;
        uniform sampler2D uWall;
        uniform float uPavingScale;
        uniform float uWallScale;

        vec3 triplanar(sampler2D tex, vec3 p, vec3 n, float scale) {
          vec3 w = pow(abs(n), vec3(4.0));
          w /= (w.x + w.y + w.z);
          vec3 x = texture2D(tex, p.zy * scale).rgb;
          vec3 y = texture2D(tex, p.xz * scale).rgb;
          vec3 z = texture2D(tex, p.xy * scale).rgb;
          return x * w.x + y * w.y + z * w.z;
        }
      `)
      .replace('#include <map_fragment>', `
        vec3 n = normalize(vWorldNormal);
        vec3 pav = triplanar(uPaving, vWorldPos, n, uPavingScale);
        vec3 wal = triplanar(uWall, vWorldPos, n, uWallScale);
        // Steep is wall, flat is paving; the crossover matches the slope the player
        // can actually climb.
        float steep = 1.0 - smoothstep(0.52, 0.80, n.y);
        diffuseColor.rgb *= mix(pav, wal, steep);
      `)

    mat.userData.shader = shader
  }
  // Force a distinct program so this material does not share a cache entry with a
  // plain MeshStandardMaterial.
  mat.customProgramCacheKey = () => 'water7-terrain-triplanar'
  return mat
}
