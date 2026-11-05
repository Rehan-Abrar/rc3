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


const overflowErrors = []
const mobileSweep = async (label, paths) => {
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of paths) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(250)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      console.log(`overflow ${label} ${width}px ${path}: ${overflow}px`)
      if (overflow > 0) overflowErrors.push(`${path} @${width}px overflows by ${overflow}px`)
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 })
}

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

  // duplicate detection -> explicit human-confirmed merge
  await page.getByRole('button', { name: 'Review', exact: true }).click()
  await page.waitForTimeout(300)
  await shot('06b-duplicate-merge')
  await page.getByRole('button', { name: 'Confirm merge' }).click()
  await page.waitForTimeout(1000)

  await page.goto(`${BASE}/recruiter/applications/1`, { waitUntil: 'networkidle' })
  await shot('07-application-detail')

  // recompute assessment, then open the human decision dialog (cancelled)
  await page.getByRole('button', { name: /Recompute/ }).click()
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'Decide' }).first().click()
  await page.waitForTimeout(300)
  await page.waitForTimeout(300)
  await shot('07b-decision-dialog')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

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

  // responsive sweep as the recruiter (no horizontal scroll allowed at 375 or 768)
  await mobileSweep('recruiter', [
    '/recruiter',
    '/recruiter/jobs',
    '/recruiter/jobs/new',
    '/recruiter/jobs/1/applicants',
    '/recruiter/applications/1',
    '/recruiter/talent',
    '/recruiter/interviews',
    '/recruiter/analytics',
  ])
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${BASE}/recruiter/jobs/1/applicants`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await shot('16-mobile-applicants')
  await page.setViewportSize({ width: 1440, height: 960 })

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
  await mobileSweep('candidate', ['/candidate', '/candidate/jobs', '/candidate/applications', '/candidate/resume'])
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${BASE}/candidate/jobs`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await shot('18-mobile-candidate')
} catch (e) {
  errors.push(`flow: ${e.message}`)
} finally {
  await browser.close()
}

console.log('\n=== console/runtime errors ===')
if (errors.length === 0) console.log('none')
else errors.forEach((e) => console.log('-', e))
process.exit(errors.length ? 1 : 0)
