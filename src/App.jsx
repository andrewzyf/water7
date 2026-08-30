import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, Preload } from '@react-three/drei'
import { EffectComposer, Bloom, SMAA, Vignette, BrightnessContrast, HueSaturation } from '@react-three/postprocessing'
import * as THREE from 'three'

import { generateCity, buildColliders } from './world/city.js'
import { generateProps } from './world/props.js'
import { landmarkColliders, propColliders } from './world/colliders.js'
import './world/debugCamera.js'
import { SKY } from './world/palette.js'
import SkyDome from './components/SkyDome.jsx'
import Island from './components/Island.jsx'
import Water from './components/Water.jsx'
import Waterfalls from './components/Waterfalls.jsx'
import CanalEdges from './components/CanalEdges.jsx'
import Ramps from './components/Ramps.jsx'
import Props from './components/Props.jsx'
import CanalTraffic from './components/CanalTraffic.jsx'
import City from './components/City.jsx'
import BridgesMesh from './components/Bridges.jsx'
import GreatFountain from './components/landmarks/GreatFountain.jsx'
import Docks from './components/landmarks/Docks.jsx'
import GalleyLaHQ from './components/landmarks/GalleyLaHQ.jsx'
import BlueStation from './components/landmarks/BlueStation.jsx'
import Outskirts from './components/landmarks/Outskirts.jsx'
import Player from './components/Player.jsx'
import PlayerBoat from './components/PlayerBoat.jsx'
import { findBoardingSpot, findLandingSpot, findRideableYagara } from './world/boarding.js'
import { trafficState } from './world/trafficState.js'
import Hud from './components/ui/Hud.jsx'
import Music from './components/ui/Music.jsx'
import MapView from './components/ui/MapView.jsx'

/**
 * Graphics quality.
 *
 * The shadow pass renders the whole island into a square map every frame regardless of
 * window size, so it dominates the frame on weaker machines — which is exactly why the
 * levels differ mostly in shadow resolution rather than in scene detail. Nothing here
 * removes any of the city; the island you explore is the same at every setting.
 */
export const QUALITY = {
  high:   { shadows: true,  shadowMap: 2048, dpr: [1, 2],   post: 'full',  soft: true },
  medium: { shadows: true,  shadowMap: 1024, dpr: [1, 1.5], post: 'basic', soft: false },
  low:    { shadows: false, shadowMap: 512,  dpr: [1, 1],   post: 'none',  soft: false },
}
const QUALITY_ORDER = ['high', 'medium', 'low']

/** One sun, shared by the light, the sky and the water's specular. */
export const SUN = new THREE.Vector3(-420, 300, 320)
export const SUN_DIR = SUN.clone().normalize()

/**
 * Warm, low afternoon sun — the light Water 7 is almost always shown in. Shadow camera
 * is sized to the whole island so the terraces cast onto each other, which is most of
 * what sells the stepped-cone silhouette.
 */
function Lighting({ quality }) {
  return (
    <>
      <hemisphereLight args={['#d3e8f4', '#8a7a60', 0.55]} />
      <ambientLight intensity={0.2} />
      {/* Shadow frustum kept tight: it has to cover the built-up terraces, and every
          metre wider costs resolution everywhere. */}
      <directionalLight
        position={[SUN.x, SUN.y, SUN.z]}
        intensity={2.5}
        color={SKY.sun}
        castShadow={quality.shadows}
        shadow-mapSize={[quality.shadowMap, quality.shadowMap]}
        shadow-camera-left={-460}
        shadow-camera-right={460}
        shadow-camera-top={460}
        shadow-camera-bottom={-460}
        shadow-camera-near={1}
        shadow-camera-far={1500}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
      {/* A cool bounce from the opposite side keeps shadowed facades from going flat. */}
      <directionalLight position={[380, 180, -300]} intensity={0.34} color="#bcd8ea" />
    </>
  )
}

export default function App() {
  const playerState = useRef(null)
  const [showMap, setShowMap] = useState(false)
  const [mode, setMode] = useState('foot')
  const [qualityName, setQualityName] = useState(() => {
    try { return localStorage.getItem('w7-quality') || 'high' } catch { return 'high' }
  })
  const quality = QUALITY[qualityName] ?? QUALITY.high
  const [boatSpawn, setBoatSpawn] = useState(null)
  const [vehicle, setVehicle] = useState('boat')
  const [footSpawn, setFootSpawn] = useState(null)

  const buildings = useMemo(() => generateCity(), [])
  const props = useMemo(() => generateProps(buildings), [buildings])
  // Everything solid in one list: the procedural city, the hand-placed landmarks, and
  // the market stalls. The landmarks used to have no collision at all.
  const colliders = useMemo(
    () => [...buildColliders(buildings), ...landmarkColliders(), ...propColliders(props)],
    [buildings, props],
  )

  // Expose live player state for the screenshot harness and for debugging from the
  // console; reading the HUD is unreliable because it samples on a timer.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__w7 = window.__w7 || {}
      window.__w7.player = () => playerState.current
      window.__w7.mode = () => mode
    }
  }, [mode])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyM') setShowMap((v) => !v)
      if (e.code === 'KeyQ') {
        setQualityName((q) => {
          const next = QUALITY_ORDER[(QUALITY_ORDER.indexOf(q) + 1) % QUALITY_ORDER.length]
          try { localStorage.setItem('w7-quality', next) } catch { /* private mode */ }
          return next
        })
      }
      if (e.code === 'KeyE') {
        const p = playerState.current
        if (!p) return
        // One key does both, because which one you mean is never ambiguous.
        if (mode === 'foot') {
          // A Yagara within reach wins over a boat: riding one is the local way to get
          // about, and if you walked up to a bull that is plainly what you meant.
          const bull = findRideableYagara(p)
          if (bull) {
            trafficState.hidden.add(bull.teamIndex)
            setBoatSpawn(bull)
            setVehicle('yagara')
            setMode('boat')
            return
          }
          const spot = findBoardingSpot(p)
          if (spot) { setBoatSpawn(spot); setVehicle('boat'); setMode('boat') }
        } else {
          const spot = findLandingSpot(p, 34)
          if (spot) {
            // Hand the bull back to its round once the player steps off.
            if (boatSpawn?.teamIndex !== undefined) trafficState.hidden.delete(boatSpawn.teamIndex)
            setFootSpawn(spot)
            setMode('foot')
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, boatSpawn])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows={quality.shadows}
        dpr={quality.dpr}
        camera={{ fov: 58, near: 0.4, far: 8000, position: [0, 60, 520] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          // Light haze only — Water 7 is almost always shown in clear afternoon air.
          scene.fog = new THREE.FogExp2(SKY.fog, 0.000115)
        }}
      >
        <SkyDome sunDirection={SUN_DIR} />
        <Lighting quality={quality} />

        <Island />
        <BridgesMesh />
        <City buildings={buildings} />
        <CanalEdges />
        <Ramps />
        <Props props={props} />
        <CanalTraffic />
        <GreatFountain />
        <Docks />
        <GalleyLaHQ />
        <BlueStation />
        <Outskirts />
        <Water sunDirection={SUN_DIR} />
        <Waterfalls />

        <Player
          colliders={colliders}
          playerState={playerState}
          active={mode === 'foot'}
          spawnOverride={footSpawn}
        />
        <PlayerBoat
          active={mode === 'boat'}
          spawn={boatSpawn}
          playerState={playerState}
          kind={vehicle}
        />

        <AdaptiveDpr pixelated />
        <Preload all />

        {quality.post !== 'none' && (
          <EffectComposer multisampling={0} disableNormalPass>
            {quality.post === 'full' ? <SMAA /> : <></>}
            {/* Just enough bloom for sun glitter on the water and the falls to lift. */}
            <Bloom intensity={0.34} luminanceThreshold={0.82} luminanceSmoothing={0.25} mipmapBlur />
            {quality.post === 'full' ? <HueSaturation saturation={0.06} /> : <></>}
            {quality.post === 'full'
              ? <BrightnessContrast brightness={0.005} contrast={0.055} />
              : <></>}
            <Vignette eskil={false} offset={0.24} darkness={0.42} />
          </EffectComposer>
        )}
      </Canvas>

      <Music />
      <Hud playerState={playerState} showMap={showMap} mode={mode} quality={qualityName} />
      <MapView playerState={playerState} buildings={buildings} visible={showMap} />
    </div>
  )
}
