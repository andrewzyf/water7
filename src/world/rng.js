/** Deterministic RNG so the city is identical every run (mulberry32). */
export function makeRng(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const rand = (rng, lo, hi) => lo + rng() * (hi - lo)
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length]
