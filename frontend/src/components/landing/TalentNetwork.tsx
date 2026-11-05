import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { CANDIDATE, NODES, nodeById } from './talent-network-data'

const Canvas = lazy(() => import('./TalentNetworkCanvas'))

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    )
  } catch {
    return false
  }
}

const cx = (x: number) => 280 + x * 64
const cy = (y: number) => 178 - y * 50

function NetworkFallback() {
  return (
    <div className="land-net__fallback">
      <svg viewBox="0 0 560 356" role="img" aria-label="A candidate profile connected to its skills, experience and verified evidence">
        {NODES.filter((node) => node.kind !== 'core').map((node) => {
          const core = NODES[0]
          return (
            <line
              key={`line-core-${node.id}`}
              x1={cx(core.position[0])}
              y1={cy(core.position[1])}
              x2={cx(node.position[0])}
              y2={cy(node.position[1])}
              stroke="#3d65bd"
              strokeWidth={1.2}
              opacity={0.6}
            />
          )
        })}
        {['python', 'postgresql', 'docker'].map((id) => {
          const node = nodeById(id)
          return (
            <line
              key={`line-ev-${id}`}
              x1={cx(nodeById('evidence').position[0])}
              y1={cy(nodeById('evidence').position[1])}
              x2={cx(node.position[0])}
              y2={cy(node.position[1])}
              stroke="#ffffff"
              strokeWidth={1}
              opacity={0.4}
            />
          )
        })}
        {NODES.filter((node) => node.kind !== 'core').map((node) => (
          <g key={node.id}>
            {node.kind === 'evidence' ? (
              <rect
                x={cx(node.position[0]) - 5}
                y={cy(node.position[1]) - 5}
                width={10}
                height={10}
                fill="#ffffff"
                transform={`rotate(45 ${cx(node.position[0])} ${cy(node.position[1])})`}
              />
            ) : node.kind === 'role' ? (
              <circle cx={cx(node.position[0])} cy={cy(node.position[1])} r={7} fill="none" stroke="#ffffff" strokeWidth={2} />
            ) : (
              <circle cx={cx(node.position[0])} cy={cy(node.position[1])} r={node.kind === 'meta' ? 4 : 5} fill="#8fb0ff" />
            )}
            <text
              x={cx(node.position[0])}
              y={cy(node.position[1]) + 22}
              textAnchor="middle"
              fill="rgba(255,255,255,0.9)"
              fontFamily="'Instrument Sans', system-ui, sans-serif"
              fontSize={13}
            >
              {node.label}
            </text>
          </g>
        ))}
        <polygon
          points={`${cx(0)},${cy(0) - 32} ${cx(0) + 30},${cy(0)} ${cx(0)},${cy(0) + 32} ${cx(0) - 30},${cy(0)}`}
          fill="#f4f7ff"
        />
      </svg>
    </div>
  )
}

export function TalentNetwork() {
  const [active, setActive] = useState('postgresql')
  const [reduced, setReduced] = useState(false)
  const [webgl, setWebgl] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setWebgl(hasWebGL())
  }, [])

  const node = nodeById(active)
  const showScene = webgl && !failed
  const fallback = <NetworkFallback />

  return (
    <div className="land-net">
      <div className="land-net__bar">
        <span className="land-net__who">
          <b>{CANDIDATE.name}</b>
          <i>{CANDIDATE.role}</i>
        </span>
        <span className="land-net__score" aria-label={`Overall score ${CANDIDATE.score} out of 100`}>
          <b>{CANDIDATE.score}</b>
          <span>/100</span>
        </span>
      </div>

      <div className="land-net__stage">
        {showScene ? (
          <SceneBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <Canvas
                active={active}
                onActive={setActive}
                reduced={reduced}
                onFail={() => setFailed(true)}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          fallback
        )}
      </div>

      <div className="land-net__readout" aria-live="polite">
        <div className="land-net__readout-head">
          <strong>{node.title}</strong>
          <span>{node.status}</span>
        </div>
        {node.quote ? <p>“{node.quote}”</p> : null}
        <em>{node.note}</em>
      </div>
    </div>
  )
}
