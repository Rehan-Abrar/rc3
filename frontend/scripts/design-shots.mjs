// Design review capture: screenshots every screen at desktop + mobile widths.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const OUT = 'screenshots/design'
mkdirSync(OUT, { recursive: true })

const problems = []
const say = (m) => console.log(m)

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/recruiter|\/candidate/, { timeout: 15000 })
  await page.waitForTimeout(600)
}

const browser = await chromium.launch()

// public screens
const pub = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const p1 = await pub.newPage()
for (const [path, name] of [['/', 'landing'], ['/login', 'login'], ['/register', 'register']]) {
  await p1.goto(BASE + path, { waitUntil: 'networkidle' })
  await p1.waitForTimeout(700)
  await p1.screenshot({ path: `${OUT}/desk-${name}.png`, fullPage: false })
  say(`shot desk-${name}`)
}
await pub.close()

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

await login(page, 'recruiter@hire.dev', 'demo1234')
const screens = [
  ['/recruiter', 'dashboard'],
  ['/recruiter/jobs', 'jobs'],
  ['/recruiter/jobs/1', 'job-detail'],
  ['/recruiter/jobs/1/applicants', 'applicants'],
  ['/recruiter/applications/1', 'application-detail'],
  ['/recruiter/talent', 'talent'],
  ['/recruiter/interviews', 'interviews'],
  ['/recruiter/analytics', 'analytics'],
  ['/recruiter/jobs/new', 'job-editor'],
]
for (const [path, name] of screens) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/desk-${name}.png`, fullPage: false })
  say(`shot desk-${name}`)
}
await ctx.close()

const cand = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const cp = await cand.newPage()
cp.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
cp.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
await login(cp, 'candidate@hire.dev', 'demo1234')
for (const [path, name] of [
  ['/candidate', 'candidate-dashboard'],
  ['/candidate/jobs', 'candidate-jobs'],
  ['/candidate/applications', 'candidate-applications'],
  ['/candidate/resume', 'candidate-resume'],
]) {
  await cp.goto(BASE + path, { waitUntil: 'networkidle' })
  await cp.waitForTimeout(700)
  await cp.screenshot({ path: `${OUT}/desk-${name}.png`, fullPage: false })
  say(`shot desk-${name}`)
}

// mobile sweep
await cp.setViewportSize({ width: 375, height: 900 })
for (const [path, name] of [
  ['/candidate', 'candidate-dashboard'],
  ['/candidate/jobs', 'candidate-jobs'],
]) {
  await cp.goto(BASE + path, { waitUntil: 'networkidle' })
  await cp.waitForTimeout(500)
  await cp.screenshot({ path: `${OUT}/m375-${name}.png` })
  const w = await cp.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  if (w[0] > w[1] + 1) problems.push(`overflow ${path} ${w[0]} > ${w[1]}`)
}
await cand.close()
await browser.close()

console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'problems: none')
