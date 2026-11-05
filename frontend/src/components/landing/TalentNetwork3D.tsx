import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { LINKS, NODES, type NetworkNode } from './talent-network-data'

interface SceneProps {
  active: string
  onActive: (id: string) => void
  reduced: boolean
}

function SkillNode({
  node,
  active,
  onActive,
  reduced,
  index,
}: {
  node: NetworkNode
  active: boolean
  onActive: (id: string) => void
  reduced: boolean
  index: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((state, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const d = Math.min(delta, 0.05)
    const target = active ? 1.35 : 1
    mesh.scale.x += (target - mesh.scale.x) * (reduced ? 1 : 0.18)
    mesh.scale.y = mesh.scale.x
    mesh.scale.z = mesh.scale.x
    if (!reduced) {
      mesh.position.y = node.position[1] + Math.sin(state.clock.elapsedTime * 0.7 + index) * 0.045
    }
    if (material.current) {
      material.current.color.lerp(
        new THREE.Color(active ? '#ffffff' : '#6f96ff'),
        reduced ? 1 : 0.18,
      )
    }
  })

  return (
    <mesh
      ref={ref}
      position={node.position}
      onPointerOver={(event) => {
        event.stopPropagation()
        onActive(node.id)
      }}
      onClick={(event) => {
        event.stopPropagation()
        onActive(node.id)
      }}
    >
      {node.kind === 'evidence' ? (
        <octahedronGeometry args={[0.19, 0]} />
      ) : node.kind === 'role' ? (
        <octahedronGeometry args={[0.18, 0]} />
      ) : node.kind === 'meta' ? (
        <cylinderGeometry args={[0.1, 0.1, 0.075, 18]} />
      ) : (
        <sphereGeometry args={[0.105, 18, 18]} />
      )}
      <meshStandardMaterial
        ref={material}
        color="#6f96ff"
        roughness={0.34}
        metalness={0.18}
        flatShading={node.kind !== 'skill'}
        emissive={node.kind === 'role' ? '#123a8c' : '#000000'}
      />
    </mesh>
  )
}

function Core() {
  const core = useRef<THREE.Mesh>(null)
  const wire = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05)
    if (core.current) {
      core.current.rotation.y += d * 0.22
      core.current.rotation.x += d * 0.09
    }
    if (wire.current) {
      wire.current.rotation.y -= d * 0.14
      wire.current.rotation.z += d * 0.06
    }
  })

  return (
    <group>
      <mesh ref={core}>
        <octahedronGeometry args={[0.92, 0]} />
        <meshStandardMaterial color="#f4f7ff" roughness={0.26} metalness={0.22} flatShading />
      </mesh>
      <mesh ref={wire} scale={1.12}>
        <octahedronGeometry args={[0.82, 0]} />
        <meshBasicMaterial color="#5d87ff" wireframe transparent opacity={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2.4, 0.35, 0]}>
        <torusGeometry args={[1.45, 0.008, 8, 120]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
      </mesh>
      <mesh rotation={[Math.PI / 1.9, -0.5, 0.6]}>
        <torusGeometry args={[1.7, 0.006, 8, 120]} />
        <meshBasicMaterial color="#9cb7ff" transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

export default function TalentNetwork3D({ active, onActive, reduced }: SceneProps) {
  const group = useRef<THREE.Group>(null)

  const positions = useMemo(
    () =>
      Object.fromEntries(
        NODES.map((node) => [node.id, new THREE.Vector3(...node.position)]),
      ) as Record<string, THREE.Vector3>,
    [],
  )

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05)
    if (reduced) return
    if (group.current) group.current.rotation.y += d * 0.022
    const px = state.pointer.x
    const py = state.pointer.y
    state.camera.position.x += (px * 0.55 - state.camera.position.x) * 0.045
    state.camera.position.y += (py * 0.38 + 0.12 - state.camera.position.y) * 0.045
    state.camera.lookAt(0, 0, 0)
  })

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-5, -3, 2]} intensity={0.5} color="#7ba0ff" />
      <pointLight position={[0, 0, 3]} intensity={7} distance={12} color="#3468ff" />

      <group ref={group}>
        <Core />

        {LINKS.map((link) => {
          const live = link.a === active || link.b === active
          const points = [positions[link.a], positions[link.b]]
          const color =
            live && link.kind === 'evidence'
              ? '#ffffff'
              : live
                ? '#c8d7ff'
                : link.kind === 'role'
                  ? '#2b4580'
                  : '#33549f'
          return (
            <Line
              key={`${link.a}-${link.b}`}
              points={points}
              color={color}
              lineWidth={live ? 1.25 : 0.7}
              transparent
              opacity={live ? 0.95 : link.kind === 'role' ? 0.2 : 0.3}
            />
          )
        })}

        {NODES.filter((node) => node.kind !== 'core').map((node, index) => (
          <SkillNode
            key={node.id}
            node={node}
            index={index}
            active={node.id === active}
            onActive={onActive}
            reduced={reduced}
          />
        ))}

        {NODES.filter((node) => node.kind !== 'core').map((node) => (
          <Html
            key={`label-${node.id}`}
            position={[node.position[0], node.position[1] + 0.32, node.position[2]]}
            center
            zIndexRange={[20, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <button
              type="button"
              className={`land-net__pill${node.id === active ? ' is-active' : ''}`}
              style={{ pointerEvents: 'auto' }}
              onPointerEnter={() => onActive(node.id)}
              onFocus={() => onActive(node.id)}
              onClick={() => onActive(node.id)}
              aria-pressed={node.id === active}
            >
              <i aria-hidden="true" />
              {node.label}
            </button>
          </Html>
        ))}
      </group>
    </>
  )
}
