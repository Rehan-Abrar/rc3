/**
 * Drives the configurable-scoring feature through the real UI against the live API:
 * the weights section on the job editor, and the What-If simulator on the ranked list.
 *
 *   node scripts/live-scoring.mjs
 *
 * Fails loudly on a console error, a 4xx/5xx response, or a simulation that changes the
 * official ranking before it is applied.
 */
import { chromium } from 'playwright-core'

const BASE = process.env.APP_URL || 'http://localhost:5173'
const API = process.env.API_URL || 'http://127.0.0.1:8000/api'
const problems = []
const badResponses = []

async function api(path, options = {}) {
  const res = await fetch(API + path, options)
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

const login = await api('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'recruiter@hire.dev', password: 'demo1234' }),
})
if (login.status !== 200) throw new Error('recruiter login failed: ' + JSON.stringify(login.body))
const token = login.body.token
const auth = { Authorization: `Bearer ${token}` }

const jobs = (await api('/jobs', { headers: auth })).body
const job = jobs.find((j) => j.title.toLowerCase().includes('backend')) || jobs[0]
if (!job) throw new Error('no seeded job found')
const before = (await api(`/applications/job/${job.id}/applicants`, { headers: auth })).body
  .map((r) => [r.candidate.name, r.score?.overall ?? null])
console.log('job:', job.id, job.title, '| ranking:', before.map(([n, s]) => `${n} ${Math.round(s)}`).join(' · '))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()) })
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
page.on('response', (r) => {
  const url = r.url()
  if (url.includes('/api/') && r.status() >= 400) badResponses.push(`${r.status()} ${r.request().method()} ${url}`)
})

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByLabel(/work email|email/i).first().fill('recruiter@hire.dev')
await page.getByLabel(/password/i).first().fill('demo1234')
await page.getByRole('button', { name: /sign in|log in/i }).first().click()
await page.waitForURL(/\/recruiter/, { timeout: 20000 })

/* ------------------------------------------------ 1. job editor weights section */
await page.goto(`${BASE}/recruiter/jobs/${job.id}/edit`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: /assessment weights/i }).waitFor({ timeout: 15000 })
const total = await page.locator('text=/Total/i').first().innerText()
console.log('editor total label:', total.replace(/\s+/g, ' '))
const sliders = page.locator('input[type="range"]')
const sliderCount = await sliders.count()
if (sliderCount < 4) problems.push(`expected 4 weight sliders in the job editor, found ${sliderCount}`)
await page.screenshot({ path: 'screenshots/live/scoring-weights-editor.png', fullPage: false })

// preset then manual nudge keeps the total at 100
await page.getByRole('button', { name: /Senior role/i }).first().click()
await page.waitForTimeout(200)
const afterPreset = await page.locator('text=/100%/').first().innerText().catch(() => '')
console.log('after preset total:', afterPreset.replace(/\s+/g, ' '))
const skillsBox = page.getByLabel(/Skills weight percent/i).first()
await skillsBox.fill('40')
await skillsBox.blur()
await page.waitForTimeout(200)
const numbers = await page.locator('input[type="number"]').evaluateAll((ns) =>
  ns.filter((n) => n.getAttribute('aria-label')?.includes('weight percent')).map((n) => Number(n.value)))
const sum = numbers.reduce((a, b) => a + b, 0)
console.log('weights after nudge:', numbers.join(' / '), '=> total', sum)
if (sum !== 100) problems.push(`editor allowed a total of ${sum}%`)

/* ------------------------------------------------ 2. what-if on the ranked list */
await page.goto(`${BASE}/recruiter/jobs/${job.id}/applicants`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /adjust weights/i }).first().click()
await page.getByRole('button', { name: /^Senior role/i }).first().click()
await page.waitForTimeout(1400)
const tableRows = page.locator('table tbody tr')
const rowCount = await tableRows.count()
if (rowCount < 1) problems.push('what-if table rendered no rows')
await page.screenshot({ path: 'screenshots/live/scoring-what-if.png', fullPage: false })

const simText = await page.locator('table').first().innerText()
console.log('what-if table:\n' + simText.split('\n').slice(0, 14).map((l) => '  ' + l).join('\n'))

// nothing may have been written yet
const during = (await api(`/applications/job/${job.id}/applicants`, { headers: auth })).body
  .map((r) => [r.candidate.name, r.score?.overall ?? null])
const movedBeforeApply = JSON.stringify(during) !== JSON.stringify(before)
if (movedBeforeApply) problems.push('the simulation changed official scores before Apply')
else console.log('official ranking unchanged while previewing: OK')

/* ------------------------------------------------ 3. apply, verify, restore */
await page.getByRole('button', { name: /^Apply$/ }).first().click()
await page.getByRole('dialog').waitFor({ timeout: 8000 })
await page.locator('input[placeholder*="Senior role"]').first().fill('Live check: experience first')
await page.screenshot({ path: 'screenshots/live/scoring-apply-dialog.png', fullPage: false })
await page.getByRole('button', { name: /save weights/i }).click()
await page.waitForTimeout(2500)

const afterApply = (await api(`/applications/job/${job.id}/applicants`, { headers: auth })).body
  .map((r) => [r.candidate.name, r.score?.overall ?? null])
const changed = JSON.stringify(afterApply) !== JSON.stringify(before)
console.log('after apply:', afterApply.map(([n, s]) => `${n} ${Math.round(s ?? 0)}`).join(' · '))
if (!changed) problems.push('applying the weights did not change official scores')

const cfg = (await api(`/jobs/${job.id}/weights`, { headers: auth })).body
console.log('saved config:', JSON.stringify(cfg.configured), '| version', cfg.version,
  '| history', cfg.history.length, '| reason:', cfg.history[0]?.reason)
if (cfg.configured.experience !== 45) problems.push('saved configuration does not match what the UI applied')
if (!cfg.history.length || cfg.history[0].reason !== 'Live check: experience first') {
  problems.push('the audit history did not record the applied change')
}

// restore the documented default so the demo state is unchanged
const restore = await api(`/jobs/${job.id}/weights`, {
  method: 'PUT',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ skills: 50, experience: 25, projects: 15, qualifications: 10, reason: 'Live check restore' }),
})
if (restore.status !== 200) problems.push('could not restore the default weights: ' + restore.status)
const restored = (await api(`/applications/job/${job.id}/applicants`, { headers: auth })).body
  .map((r) => [r.candidate.name, r.score?.overall ?? null])
const backToStart = JSON.stringify(restored) === JSON.stringify(before)
console.log('restored ranking identical to start:', backToStart)
if (!backToStart) problems.push('restoring the default did not reproduce the original scores')

await browser.close()

if (badResponses.length) problems.push('failed API responses: ' + badResponses.join(', '))
if (problems.length) {
  console.error('\nFAILED:\n' + problems.map((p) => '  - ' + p).join('\n'))
  process.exit(1)
}
console.log('\nAll scoring checks passed: editor validates, simulator writes nothing, apply recalcs and audits, restore is exact.')
