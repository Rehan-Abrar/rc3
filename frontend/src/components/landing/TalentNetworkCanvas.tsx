import { Canvas } from '@react-three/fiber'
import TalentNetwork3D from './TalentNetwork3D'

export default function TalentNetworkCanvas({
  active,
  onActive,
  reduced,
  onFail,
}: {
  active: string
  onActive: (id: string) => void
  reduced: boolean
  onFail: () => void
}) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0.12, 8.2], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ touchAction: 'pan-y' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          onFail()
        })
      }}
    >
      <TalentNetwork3D active={active} onActive={onActive} reduced={reduced} />
    </Canvas>
  )
}
