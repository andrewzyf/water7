import { useEffect, useRef, useState } from 'react'

const TRACK = 'audio/mother-sea.mp3'
const STORAGE_KEY = 'w7-music'

/**
 * Background music.
 *
 * Browsers refuse to start audio before the page has been interacted with, so playback
 * is armed on the first click or keypress rather than on mount — which is also the
 * moment the player starts exploring, so it lands naturally. The choice is remembered,
 * and the track fades in rather than cutting in at full volume.
 */
export default function Music() {
  const audioRef = useRef(null)
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== 'off' } catch { return true }
  })
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const a = new Audio(TRACK)
    a.loop = true
    a.volume = 0
    a.preload = 'auto'
    audioRef.current = a
    return () => { a.pause(); audioRef.current = null }
  }, [])

  // Arm on the first gesture; browsers block audio before one.
  useEffect(() => {
    if (started) return
    const arm = () => {
      setStarted(true)
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
    window.addEventListener('pointerdown', arm)
    window.addEventListener('keydown', arm)
    return () => {
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
  }, [started])

  useEffect(() => {
    const a = audioRef.current
    if (!a || !started) return
    let raf
    if (on) {
      a.play().catch(() => { /* still blocked; the next gesture will retry */ })
      const fade = () => {
        a.volume = Math.min(0.34, a.volume + 0.006)
        if (a.volume < 0.34) raf = requestAnimationFrame(fade)
      }
      fade()
    } else {
      const fade = () => {
        a.volume = Math.max(0, a.volume - 0.02)
        if (a.volume > 0) raf = requestAnimationFrame(fade)
        else a.pause()
      }
      fade()
    }
    return () => cancelAnimationFrame(raf)
  }, [on, started])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'KeyN') return
      setOn((v) => {
        const next = !v
        try { localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off') } catch { /* private mode */ }
        return next
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}
