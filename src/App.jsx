import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky, AdaptiveDpr, Preload } from '@react-three/drei'
import * as THREE from 'three'

import { generateCity, buildColliders } from './world/city.js'
import './world/debugCamera.js'
import { SKY } from './world/palette.js'
import Island from './components/Island.jsx'
import Water from './components/Water.jsx'
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

/**
 * Warm, low afternoon sun — the light Water 7 is almost always shown in. Shadow camera
 * is sized to the whole island so the terraces cast onto each other, which is most of
 * what sells the stepped-cone silhouette.
 */
function Lighting() {
  return (
    <>
      <hemisphereLight args={['#cfe6f2', '#7a7160', 0.62]} />
      <ambientLight intensity={0.24} />
      <directionalLight
        position={[-420, 320, 300]}
        intensity={2.1}
        color={SKY.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-620}
        shadow-camera-right={620}
        shadow-camera-top={620}
        shadow-camera-bottom={-620}
        shadow-camera-near={1}
        shadow-camera-far={1600}
        shadow-bias={-0.0006}
      />
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
        dpr={[1, 1.8]}
        camera={{ fov: 58, near: 0.4, far: 8000, position: [0, 60, 520] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.02
          scene.fog = new THREE.Fog(SKY.fog, 900, 3400)
        }}
      >
        <Sky
          distance={4500}
          sunPosition={[-420, 190, 300]}
          turbidity={5}
          rayleigh={1.4}
          mieCoefficient={0.006}
          mieDirectionalG={0.83}
        />
        <Lighting />

        <Island />
        <BridgesMesh />
        <City buildings={buildings} />
        <GreatFountain />
        <Docks />
        <GalleyLaHQ />
        <BlueStation />
        <Outskirts />
        <Water />

        <Player colliders={colliders} playerState={playerState} />
        {showLabels && <Labels />}

        <AdaptiveDpr pixelated />
        <Preload all />
      </Canvas>

      <Hud playerState={playerState} showLabels={showLabels} showMap={showMap} />
      <MapView playerState={playerState} buildings={buildings} visible={showMap} />
    </div>
  )
}
