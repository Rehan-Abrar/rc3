/**
 * Candidate-side live check: the same applications the recruiter sees, plus the resume file link.
 * Run: node scripts/live-check-candidate.mjs
 */
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = 'screenshots/live'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url())
})

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByLabel(/work email|email/i).first().fill(process.env.EMAIL ?? 'rehan@rc3.dev')
await page.getByLabel(/password/i).first().fill(process.env.PASSWORD ?? 'demo1234')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForURL(/candidate/, { timeout: 20000 })
await page.waitForLoadState('networkidle')
await page.waitForTimeout(800)
await page.screenshot({ path: OUT + '/05-candidate-dashboard.png', fullPage: true })

await page.goto(BASE + '/candidate/resume', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: OUT + '/06-candidate-resume.png', fullPage: true })

const link = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a'))
    .map((a) => ({ text: a.textContent?.trim() || '', href: a.href }))
    .find((a) => /view file/i.test(a.text)),
)
let file = null
if (link) {
  const res = await page.request.get(link.href)
  file = { status: res.status(), type: (res.headers()['content-type'] || '').split(';')[0], bytes: (await res.body()).length }
}

const body = await page.evaluate(() => document.body.innerText)
const checks = {
  resume_listed: /Rehan_Abrar_CV\.pdf/.test(body),
  view_file_link: Boolean(link),
  file_fetch_ok: Boolean(file && file.status === 200 && file.bytes > 5000),
  docx_or_pdf: /PDF|DOCX/.test(body),
  no_fixture_names: !/Nadia Rahman|Priya/.test(body),
}

console.log('URL:', page.url())
console.log('CHECKS:', JSON.stringify(checks, null, 1))
console.log('FILE:', JSON.stringify(file))
console.log('ERRORS:', errors.length ? errors.slice(0, 6) : 'none')
await browser.close()
process.exit(errors.length === 0 && checks.file_fetch_ok ? 0 : 1)
