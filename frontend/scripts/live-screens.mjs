/**
 * Walks every screen for both roles against the live API and reports blank/erroneous pages.
 *
 *   node scripts/live-screens.mjs
 */
import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const problems = []
const summary = []

const browser = await chromium.launch({ channel: 'chrome', headless: true })

const signIn = async (email) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  page.on('pageerror', (e) => problems.push(`${email}: pageerror ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && problems.push(`${email}: console ${m.text()}`))
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400) {
      problems.push(`${email}: http ${r.status()} ${r.url().split('/api')[1]}`)
    }
  })
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.getByLabel(/work email|email/i).first().fill(email)
  await page.getByLabel(/password/i).first().fill('demo1234')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/(recruiter|candidate)/, { timeout: 20000 })
  return page
}

const visit = async (page, role, path, label) => {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const info = await page.evaluate(() => ({
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 120),
    chars: document.body.innerText.replace(/\s+/g, ' ').trim().length,
    cards: document.querySelectorAll('article, li, tr').length,
  }))
  const file = `screenshots/live/${role}-${label}.png`
  await page.screenshot({ path: file, fullPage: true })
  if (info.chars < 60) problems.push(`${role} ${path}: page looks blank (${info.chars} chars)`)
  if (/application not found|something went wrong|failed to fetch|networkerror/i.test(info.text)) {
    problems.push(`${role} ${path}: error state "${info.text}"`)
  }
  summary.push(`${role.padEnd(9)} ${path.padEnd(38)} ${String(info.chars).padStart(5)} chars, ${String(info.cards).padStart(2)} blocks -> ${file}`)
}

const recruiter = await signIn('recruiter@hire.dev')
await visit(recruiter, 'recruiter', '/recruiter', 'dashboard')
await visit(recruiter, 'recruiter', '/recruiter/jobs', 'jobs')
await visit(recruiter, 'recruiter', '/recruiter/jobs/1/applicants', 'applicants-job1')
await visit(recruiter, 'recruiter', '/recruiter/jobs/2/applicants', 'applicants-job2')
await visit(recruiter, 'recruiter', '/recruiter/applications/1', 'application-detail')
await visit(recruiter, 'recruiter', '/recruiter/interviews', 'interviews')
await visit(recruiter, 'recruiter', '/recruiter/analytics', 'analytics')
await visit(recruiter, 'recruiter', '/recruiter/talent', 'talent')

const candidate = await signIn('candidate@hire.dev')
await visit(candidate, 'candidate', '/candidate', 'dashboard')
await visit(candidate, 'candidate', '/candidate/jobs', 'browse-jobs')
await visit(candidate, 'candidate', '/candidate/applications', 'applications')
await visit(candidate, 'candidate', '/candidate/resume', 'resume')

console.log(summary.join('\n'))
console.log(problems.length ? '\nPROBLEMS:\n - ' + problems.join('\n - ') : '\nNo console errors, no 4xx/5xx, no blank pages.')
await browser.close()
process.exit(problems.length ? 1 : 0)
