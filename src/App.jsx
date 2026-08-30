import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky, AdaptiveDpr, Preload, SoftShadows } from '@react-three/drei'
import { EffectComposer, Bloom, SMAA, Vignette, BrightnessContrast, HueSaturation } from '@react-three/postprocessing'
import * as THREE from 'three'

import { generateCity, buildColliders } from './world/city.js'
import './world/debugCamera.js'
import { SKY } from './world/palette.js'
import Island from './components/Island.jsx'
import Water from './components/Water.jsx'
import Waterfalls from './components/Waterfalls.jsx'
import City from './components/City.jsx'
import BridgesMesh from './components/Bridges.jsx'
import GreatFountain from './components/landmarks/GreatFountain.jsx'
import Docks from './components/landmarks/Docks.jsx'
import GalleyLaHQ from './components/landmarks/GalleyLaHQ.jsx'
import BlueStation from './components/landmarks/BlueStation.jsx'
import Outskirts from './components/landmarks/Outskirts.jsx'
import Player from './components/Player.jsx'
import Hud from './components/ui/Hud.jsx'
import Labels from './components/ui/Labels.jsx'
import MapView from './components/ui/MapView.jsx'

/** One sun, shared by the light, the sky and the water's specular. */
export const SUN = new THREE.Vector3(-420, 300, 320)
export const SUN_DIR = SUN.clone().normalize()

/**
 * Warm, low afternoon sun — the light Water 7 is almost always shown in. Shadow camera
 * is sized to the whole island so the terraces cast onto each other, which is most of
 * what sells the stepped-cone silhouette.
 */
function Lighting() {
  return (
    <>
      <hemisphereLight args={['#d3e8f4', '#8a7a60', 0.55]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[SUN.x, SUN.y, SUN.z]}
        intensity={2.5}
        color={SKY.sun}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-520}
        shadow-camera-right={520}
        shadow-camera-top={520}
        shadow-camera-bottom={-520}
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
  const [showLabels, setShowLabels] = useState(true)
  const [showMap, setShowMap] = useState(false)

  const buildings = useMemo(() => generateCity(), [])
  const colliders = useMemo(() => buildColliders(buildings), [buildings])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyM') setShowMap((v) => !v)
      if (e.code === 'KeyL') setShowLabels((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 58, near: 0.4, far: 8000, position: [0, 60, 520] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.06
          // Light haze only — Water 7 is almost always shown in clear afternoon air.
          scene.fog = new THREE.FogExp2(SKY.fog, 0.000115)
        }}
      >
        <Sky
          distance={4500}
          sunPosition={[SUN.x, SUN.y * 0.62, SUN.z]}
          turbidity={5}
          rayleigh={1.4}
          mieCoefficient={0.006}
          mieDirectionalG={0.83}
        />
        <SoftShadows size={26} samples={12} focus={0.9} />
        <Lighting />

        <Island />
        <BridgesMesh />
        <City buildings={buildings} />
        <GreatFountain />
        <Docks />
        <GalleyLaHQ />
        <BlueStation />
        <Outskirts />
        <Water sunDirection={SUN_DIR} />
        <Waterfalls />

        <Player colliders={colliders} playerState={playerState} />
        {showLabels && <Labels />}

        <AdaptiveDpr pixelated />
        <Preload all />

        <EffectComposer multisampling={0} disableNormalPass>
          <SMAA />
          {/* Just enough bloom for sun glitter on the water and the falls to lift. */}
          <Bloom intensity={0.42} luminanceThreshold={0.72} luminanceSmoothing={0.28} mipmapBlur />
          <HueSaturation saturation={0.06} />
          <BrightnessContrast brightness={0.005} contrast={0.055} />
          <Vignette eskil={false} offset={0.24} darkness={0.42} />
        </EffectComposer>
      </Canvas>

      <Hud playerState={playerState} showLabels={showLabels} showMap={showMap} />
      <MapView playerState={playerState} buildings={buildings} visible={showMap} />
    </div>
  )
}
