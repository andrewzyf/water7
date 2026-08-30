/**
 * Fixed review camera.
 *
 * The blockout has to be judged from consistent angles — the sea approach, an overhead
 * plan, the ceremonial spine — so this lets a camera position be set from outside the
 * React tree (a console, or the screenshot harness) without disturbing the player.
 * Exposed on window as `__w7.setCamera({ pos, look })`; `__w7.release()` gives control
 * back to the character.
 */
export const debugCam = {
  active: false,
  pos: [0, 200, 700],
  look: [0, 40, 0],
}

if (typeof window !== 'undefined') {
  window.__w7 = {
    setCamera({ pos, look }) {
      debugCam.pos = pos
      debugCam.look = look ?? [0, 40, 0]
      debugCam.active = true
    },
    release() { debugCam.active = false },
  }
}
