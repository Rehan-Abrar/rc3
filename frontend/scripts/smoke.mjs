/**
 * Smoke test the demo journey in a real Chrome.
 * Run: node scripts/smoke.mjs   (needs the vite dev server on :5173)
 */
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = 'screenshots'
await mkdir(OUT, { recursive: true })

const errors = []
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const shot = async (name) => {
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  console.log('shot', name)
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await shot('01-login')

  await page.getByRole('button', { name: /Recruiter/ }).first().click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/recruiter', { timeout: 8000 })
  await shot('02-recruiter-dashboard')

  await page.goto(`${BASE}/recruiter/jobs`, { waitUntil: 'networkidle' })
  await shot('03-jobs')

  await page.goto(`${BASE}/recruiter/jobs/1`, { waitUntil: 'networkidle' })
  await shot('04-job-detail')

  await page.goto(`${BASE}/recruiter/jobs/1/applicants`, { waitUntil: 'networkidle' })
  await shot('05-applicants')
  await page.getByRole('button', { name: /Why\?/ }).first().click()
  await page.waitForTimeout(700)
  await shot('06-applicant-evidence')

  await page.goto(`${BASE}/recruiter/applications/1`, { waitUntil: 'networkidle' })
  await shot('07-application-detail')

  await page.goto(`${BASE}/recruiter/analytics`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await shot('08-analytics')

  await page.goto(`${BASE}/recruiter/talent`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Python developers with REST/ }).click()
  await page.waitForTimeout(900)
  await shot('09-talent-search')

  await page.goto(`${BASE}/recruiter/jobs/1/edit`, { waitUntil: 'networkidle' })
  await shot('10-job-editor')

  await page.goto(`${BASE}/recruiter/interviews`, { waitUntil: 'networkidle' })
  await shot('11-interviews')

  // candidate journey
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Candidate/ }).first().click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/candidate', { timeout: 8000 })
  await shot('12-candidate-dashboard')

  await page.goto(`${BASE}/candidate/jobs`, { waitUntil: 'networkidle' })
  await shot('13-candidate-jobs')

  await page.goto(`${BASE}/candidate/applications`, { waitUntil: 'networkidle' })
  await shot('14-candidate-applications')

  await page.goto(`${BASE}/candidate/resume`, { waitUntil: 'networkidle' })
  await shot('15-candidate-resume')

  // mobile width check for horizontal scroll
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${BASE}/recruiter/jobs/1/applicants`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log('mobile horizontal overflow px:', overflow)
  await shot('16-mobile-applicants')
} catch (e) {
  errors.push(`flow: ${e.message}`)
} finally {
  await browser.close()
}

console.log('\n=== console/runtime errors ===')
if (errors.length === 0) console.log('none')
else errors.forEach((e) => console.log('-', e))
process.exit(errors.length ? 1 : 0)
