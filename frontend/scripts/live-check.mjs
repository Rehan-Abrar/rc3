/**
 * Live-stack UI check: real backend on :8000, vite on :5173, no fixtures.
 * Usage: node scripts/live-check.mjs
 */
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = 'screenshots/live'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`)
})

const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
const text = () => page.evaluate(() => document.body.innerText)

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await shot('01-login')

// Sign in with the seeded demo recruiter (quick-login chips are fixtures-only).
await page.getByLabel(/work email|email/i).first().fill(process.env.EMAIL ?? 'recruiter@hire.dev')
await page.getByLabel(/password/i).first().fill(process.env.PASSWORD ?? 'demo1234')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForURL(/recruiter/, { timeout: 20000 }).catch(() => {})
await page.waitForLoadState('networkidle')
await page.waitForTimeout(600)
await shot('02-recruiter-dashboard')
const dash = await text()

// Open the seeded job's applicant list.
const jobLink = page.getByText('Backend Developer').first()
let applicantText = ''
if (await jobLink.count()) {
  await jobLink.click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1200)
  await shot('03-applicants')
  applicantText = await text()
}

const checks = {
  dashboard_loaded: /recruiter|dashboard|jobs/i.test(dash),
  job_visible: /Backend Developer/i.test(applicantText || dash),
  ayesha: /Ayesha Khan/i.test(applicantText || dash),
  bilal: /Bilal Ahmed/i.test(applicantText || dash),
  sana: /Sana Iqbal/i.test(applicantText || dash),
  score_shown: /\b\d{1,3}(\.\d)?\b/.test(applicantText),
  fixtures_leak: /Nadia|Priya|fixture/i.test(dash + applicantText),
}

console.log('URL:', page.url())
console.log('CHECKS:', JSON.stringify(checks, null, 1))
console.log('ERRORS:', errors.length ? errors.slice(0, 8) : 'none')
console.log('SCREENSHOTS:', `${OUT}/01-login.png, 02-recruiter-dashboard.png, 03-applicants.png`)
await browser.close()
process.exit(errors.length === 0 && checks.ayesha ? 0 : 1)
