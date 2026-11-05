// Responsive sweep across every route at 375 and 768, live backend.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const OUT = 'screenshots/responsive'
mkdirSync(OUT, { recursive: true })

const problems = []
const browser = await chromium.launch()

async function signIn(page, role, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL(new RegExp(`/${role}`), { timeout: 15000 })
}

async function sweep(page, role, routes, width) {
  await page.setViewportSize({ width, height: 900 })
  for (const [path, name] of routes) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(450)
    const [scrollW, innerW] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    if (scrollW > innerW + 1) problems.push(`overflow ${width}px ${path}: ${scrollW} > ${innerW}`)
    await page.screenshot({ path: `${OUT}/${width}-${role}-${name}.png` })
    console.log('shot', width, role, name)
  }
}

const ctx = await browser.newContext({ viewport: { width: 375, height: 900 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

const recruiterRoutes = [
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
const candidateRoutes = [
  ['/candidate', 'dashboard'],
  ['/candidate/jobs', 'jobs'],
  ['/candidate/applications', 'applications'],
  ['/candidate/resume', 'resume'],
]

await signIn(page, 'recruiter', 'recruiter@hire.dev', 'demo1234')
for (const w of [375, 768]) await sweep(page, 'recruiter', recruiterRoutes, w)
await ctx.close()

const cctx = await browser.newContext({ viewport: { width: 375, height: 900 } })
const cpage = await cctx.newPage()
cpage.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
cpage.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
await signIn(cpage, 'candidate', 'candidate@hire.dev', 'demo1234')
for (const w of [375, 768]) await sweep(cpage, 'candidate', candidateRoutes, w)

await browser.close()
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'problems: none')
