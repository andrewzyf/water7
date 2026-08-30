import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { buildCanals, buildSea } from '../world/water/canalGeometry.js'
import { createWaterMaterial } from '../world/water/WaterMaterial.js'

/**
 * The sea and the canal network, each one draw call.
 *
 * Geometry lives in world/water/canalGeometry.js so the layout verifier can assert its
 * winding; this component only supplies the materials and drives their clock.
 */
export default function Water({ sunDirection }) {
  const canalGeo = useMemo(buildCanals, [])
  const seaGeo = useMemo(buildSea, [])

  const canalMat = useMemo(() => createWaterMaterial({
    waveAmp: 0,
    flowSpeed: 0.20,
    rippleScale: 0.075,
    foam: 1.0,
    opacity: 0.94,
    shallow: '#4fbdb0',
    deep: '#0d4b55',
  }), [])

  const seaMat = useMemo(() => createWaterMaterial({
    waveAmp: 0.78,
    waveScale: 0.013,
    flowSpeed: 0.05,
    rippleScale: 0.022,
    foam: 0.55,
    opacity: 0.94,
    shallow: '#2d8fae',
    deep: '#0e4463',
  }), [])

  const mats = useRef([canalMat, seaMat])
  useFrame(({ clock }) => {
    for (const m of mats.current) {
      m.uniforms.uTime.value = clock.elapsedTime
      if (sunDirection) m.uniforms.uSunDir.value.copy(sunDirection)
    }
  })

  return (
    <group>
      <mesh geometry={seaGeo} material={seaMat} renderOrder={2} frustumCulled={false} />
      <mesh geometry={canalGeo} material={canalMat} renderOrder={3} frustumCulled={false} />
    </group>
  )
}
