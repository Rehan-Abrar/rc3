/**
 * Proves the reported bug is gone: open an application, schedule an interview through the
 * dialog, and confirm it lands in the API and on the Interviews page.
 *
 *   node scripts/live-interview.mjs
 */
import { chromium } from 'playwright-core'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const API = process.env.API ?? 'http://127.0.0.1:8000/api'
const problems = []

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()))
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) {
    problems.push(`http ${r.status()} ${r.url().split('/api')[1]}`)
  }
})

const signIn = async (email, password) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.getByLabel(/work email|email/i).first().fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/(recruiter|candidate)/, { timeout: 20000 })
}

await signIn('recruiter@hire.dev', 'demo1234')

// 1. find Ayesha's application id through the API, then open it in the UI
const token = await page.evaluate(() => localStorage.getItem('hi.token'))
const rows = await page.evaluate(async ({ api, token }) => {
  const res = await fetch(api + '/jobs/1/applicants', { headers: { Authorization: 'Bearer ' + token } })
  return res.json()
}, { api: API, token })
const target = rows.find((r) => r.candidate.name.startsWith('Ayesha'))
if (!target) problems.push('Ayesha not found in the applicant list')

await page.goto(`${BASE}/recruiter/applications/${target.application_id}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const showsName = await page.getByText('Ayesha Khan').first().isVisible().catch(() => false)
if (!showsName) problems.push('application detail did not render the candidate name')
await page.screenshot({ path: 'screenshots/live/10-application-detail.png', fullPage: true })

// 2. open the schedule dialog and book a slot three days out
const schedule = page.getByRole('button', { name: /^schedule/i }).first()
if (!(await schedule.isVisible().catch(() => false))) {
  problems.push('no Schedule button on the application detail page')
} else {
  await schedule.click()
  await page.waitForTimeout(400)
  const when = new Date(Date.now() + 3 * 86400000)
  when.setHours(15, 0, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  const value = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`
  const field = page.locator('input[type="datetime-local"]').first()
  await field.fill(value)
  await page.screenshot({ path: 'screenshots/live/11-interview-dialog.png', fullPage: true })
  const submit = page.getByRole('button', { name: /^(schedule|book|save|confirm)/i }).last()
  await submit.click()
  await page.waitForTimeout(2500)
  const body = await page.locator('body').innerText()
  const failed = /application not found|could not schedule|conflict/i.test(body)
  if (failed) problems.push('scheduling still fails: ' + body.match(/application not found[^\n]*/i)?.[0])

  // 3. confirm through the API that the interview exists
  const list = await page.evaluate(async ({ api, token }) => {
    const res = await fetch(api + '/interviews', { headers: { Authorization: 'Bearer ' + token } })
    return res.json()
  }, { api: API, token })
  const created = list.some((i) => i.application_id === target.application_id)
  if (!created) problems.push('interview was not persisted for application ' + target.application_id)
  console.log('interviews now:', list.map((i) => `${i.candidate_name} @ ${i.scheduled_at}`).join(' | ') || 'none')
}

// 4. the Interviews page must show it too
await page.goto(BASE + '/recruiter/interviews', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const pageText = await page.locator('body').innerText()
if (!/Ayesha/i.test(pageText)) problems.push('Interviews page does not list Ayesha')
await page.screenshot({ path: 'screenshots/live/12-interviews.png', fullPage: true })

console.log(problems.length ? 'PROBLEMS:\n - ' + problems.join('\n - ') : 'All interview-flow checks passed.')
await browser.close()
process.exit(problems.length ? 1 : 0)
