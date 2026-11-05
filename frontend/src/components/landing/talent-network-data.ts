export type NodeKind = 'core' | 'skill' | 'evidence' | 'role' | 'meta'

export interface NetworkNode {
  id: string
  label: string
  kind: NodeKind
  position: [number, number, number]
  title: string
  status: string
  quote?: string
  note: string
}

/**
 * The real seeded assessment: Ayesha Khan, application 1, Backend Developer.
 * Overall 94 — quotes and requirement labels come from the app's fixture data,
 * so the hero never invents a capability the product does not have.
 */
export const CANDIDATE = {
  name: 'Ayesha Khan',
  role: 'Backend Developer',
  score: 94,
  meta: '4 of 4 required skills evidenced',
}

export const NODES: NetworkNode[] = [
  {
    id: 'core',
    label: '',
    kind: 'core',
    position: [0, 0, 0],
    title: 'Candidate profile',
    status: 'Score 94 · high confidence',
    note: 'Every dimension below is computed from this resume.',
  },
  {
    id: 'python',
    label: 'Python',
    kind: 'skill',
    position: [-2.45, 1.35, 0.1],
    title: 'Python',
    status: 'Required · matched',
    quote: 'Backend engineer with 5 years building production APIs and data-heavy services.',
    note: 'Django services, 4 years at Nordvale.',
  },
  {
    id: 'postgresql',
    label: 'PostgreSQL',
    kind: 'skill',
    position: [2.4, 1.5, -0.3],
    title: 'PostgreSQL',
    status: 'Required · matched',
    quote: 'Led the migration from MySQL to PostgreSQL with zero downtime.',
    note: 'Schema design and query tuning.',
  },
  {
    id: 'docker',
    label: 'Docker',
    kind: 'skill',
    position: [2.55, -0.7, 0.45],
    title: 'Docker',
    status: 'Required · matched',
    quote: 'Containerised the whole stack with Docker and docker-compose for local and CI parity.',
    note: 'Container builds and CI workflows.',
  },
  {
    id: 'experience',
    label: 'Experience',
    kind: 'meta',
    position: [-1.25, -2.15, 0.65],
    title: 'Experience',
    status: '5 years · above the 3-year bar',
    quote: 'Senior Backend Engineer — Northwind Logistics (Mar 2021 – Present).',
    note: '25% of the score.',
  },
  {
    id: 'projects',
    label: 'Projects',
    kind: 'meta',
    position: [1.35, -2.05, -0.35],
    title: 'Projects',
    status: '1 project counted',
    quote: 'Ledger Service — Django + PostgreSQL with idempotent payment writes.',
    note: '15% of the score.',
  },
  {
    id: 'evidence',
    label: 'Verified evidence',
    kind: 'evidence',
    position: [0, 1.95, 0.55],
    title: 'Verified evidence',
    status: '4 of 4 required skills quoted',
    quote: 'Every requirement opens the sentence it was taken from.',
    note: 'Green quote chips on every skill row.',
  },
  {
    id: 'role',
    label: 'Job requirements',
    kind: 'role',
    position: [-2.7, -0.55, -0.85],
    title: 'Backend Developer',
    status: 'Python · Django · PostgreSQL · Docker',
    note: 'REST API preferred. BS Computer Science required.',
  },
]

export type LinkKind = 'core' | 'evidence' | 'role'

export interface NetworkLink {
  a: string
  b: string
  kind: LinkKind
}

export const LINKS: NetworkLink[] = [
  { a: 'core', b: 'python', kind: 'core' },
  { a: 'core', b: 'postgresql', kind: 'core' },
  { a: 'core', b: 'docker', kind: 'core' },
  { a: 'core', b: 'experience', kind: 'core' },
  { a: 'core', b: 'projects', kind: 'core' },
  { a: 'core', b: 'role', kind: 'core' },
  { a: 'core', b: 'evidence', kind: 'core' },
  { a: 'evidence', b: 'python', kind: 'evidence' },
  { a: 'evidence', b: 'postgresql', kind: 'evidence' },
  { a: 'evidence', b: 'docker', kind: 'evidence' },
]

export const nodeById = (id: string): NetworkNode =>
  NODES.find((node) => node.id === id) ?? NODES[0]
