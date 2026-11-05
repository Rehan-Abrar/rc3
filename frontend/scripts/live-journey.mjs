/**
 * Integration check against the real FastAPI backend (VITE_USE_FIXTURES=0).
 * Assumes: backend on 127.0.0.1:8000 (seeded), vite on :5173 with the /api proxy.
 * Fails loudly on any 4xx/5xx, page error or console error.
 */
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = 'screenshots'
await mkdir(OUT, { recursive: true })

const problems = []
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })

page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`)
})
page.on('response', async (res) => {
  if (!res.url().includes('/api/') || res.status() < 400) return
  let body = ''
  try {
    body = (await res.text()).slice(0, 220)
  } catch {
    /* body already consumed */
  }
  problems.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE, '')} ${body}`)
})

const shot = async (name) => {
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot', name)
}

const signIn = async (role) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: new RegExp(role, 'i') }).first().click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`**/${role.toLowerCase()}`, { timeout: 15000 })
}

try {
  // ---------------- recruiter ----------------
  await signIn('Recruiter')
  await shot('live-01-dashboard')

  await page.goto(`${BASE}/recruiter/jobs`, { waitUntil: 'networkidle' })
  await shot('live-02-jobs')

  const jobId = await page.evaluate(async () => {
    const token = localStorage.getItem('hi.token') ?? ''
    const res = await fetch('/api/jobs', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('jobs list failed: ' + res.status)
    const jobs = await res.json()
    return jobs[0]?.id ?? 1
  })

  await page.goto(`${BASE}/recruiter/jobs/${jobId}`, { waitUntil: 'networkidle' })
  await shot('live-03-job-detail')

  await page.goto(`${BASE}/recruiter/jobs/${jobId}/applicants`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await shot('live-04-applicants')

  const appId = await page.evaluate(async (id) => {
    const token = localStorage.getItem('hi.token') ?? ''
    const res = await fetch(`/api/jobs/${id}/applicants`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return 1
    const apps = await res.json()
    return apps[0]?.application_id ?? apps[0]?.id ?? 1
  }, jobId)

  await page.goto(`${BASE}/recruiter/applications/${appId}`, { waitUntil: 'networkidle' })
  await shot('live-05-application-detail')

  await page.goto(`${BASE}/recruiter/talent`, { waitUntil: 'networkidle' })
  const search = page.getByPlaceholder(/Search|Describe/i).first()
  if (await search.count()) {
    await search.fill('Python developers with PostgreSQL and Docker')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2500)
  }
  await shot('live-06-talent-search')

  await page.goto(`${BASE}/recruiter/interviews`, { waitUntil: 'networkidle' })
  await shot('live-07-interviews')

  await page.goto(`${BASE}/recruiter/analytics`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await shot('live-08-analytics')

  // ---------------- candidate ----------------
  await page.evaluate(() => localStorage.clear())
  await signIn('Candidate')
  await shot('live-09-candidate-dashboard')

  await page.goto(`${BASE}/candidate/jobs`, { waitUntil: 'networkidle' })
  await shot('live-10-candidate-jobs')

  await page.goto(`${BASE}/candidate/applications`, { waitUntil: 'networkidle' })
  await shot('live-11-candidate-applications')

  await page.goto(`${BASE}/candidate/resume`, { waitUntil: 'networkidle' })
  await shot('live-12-candidate-resume')
} catch (e) {
  problems.push(`flow: ${e.message}`)
} finally {
  await browser.close()
}

console.log('\n=== live integration problems ===')
if (problems.length === 0) console.log('none')
else problems.forEach((p) => console.log('-', p))
process.exit(problems.length ? 1 : 0)
