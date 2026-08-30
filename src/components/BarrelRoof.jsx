import * as THREE from 'three'

/**
 * A half-barrel vault sitting on a rectangular building.
 *
 * The vault is a full cylinder whose lower half is buried in the walls, which is what
 * leaves a clean semicircular arch on the gable. That only works if the cylinder is
 * shorter than the building is deep — otherwise its end cap stands proud of the wall
 * and the whole disc shows, reading as a giant bullseye rather than a roof. This
 * enforces the inset in one place so it cannot be got wrong per building.
 *
 * @param width  building width; the vault spans it
 * @param depth  building depth; the ridge runs along it
 * @param rise   crown height above the wall head, as a fraction of half the width
 */
export default function BarrelRoof({
  width, depth, rise = 0.62, position = [0, 0, 0], rotation = 0,
  map, color, overhang = 1.04, ...rest
}) {
  const radius = (width * overhang) / 2
  return (
    <mesh
      position={position}
      rotation={[Math.PI / 2, 0, rotation]}
      scale={[1, 1, rise]}
      castShadow
      {...rest}
    >
      {/* Length is 96% of the depth, so both caps stay inside the gable walls. */}
      <cylinderGeometry args={[radius, radius, depth * 0.96, 30]} />
      <meshStandardMaterial map={map} color={color} roughness={0.8} />
    </mesh>
  )
}
