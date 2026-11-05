/**
 * Live check for the real-CV demo job: ranked applicants from real PDF/DOCX files,
 * plus the "View file" links that stream the stored documents back.
 * Run: node scripts/live-check-real-cvs.mjs
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

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByLabel(/work email|email/i).first().fill(process.env.EMAIL ?? 'recruiter@hire.dev')
await page.getByLabel(/password/i).first().fill(process.env.PASSWORD ?? 'demo1234')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForURL(/recruiter/, { timeout: 20000 })
await page.waitForLoadState('networkidle')

// Product Engineer job holds the three real CVs.
await page.goto(BASE + '/recruiter/jobs/2/applicants', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: OUT + '/04-real-cv-applicants.png', fullPage: true })
const listText = await page.evaluate(() => document.body.innerText)

const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a'))
    .map((a) => ({ text: a.textContent?.trim() || '', href: a.href }))
    .filter((a) => /\.pdf|\.docx|view resume/i.test(a.text)),
)

const fetched = []
for (const link of links.slice(0, 3)) {
  const res = await page.request.get(link.href)
  fetched.push({
    text: link.text,
    status: res.status(),
    type: (res.headers()['content-type'] || '').split(';')[0],
    disposition: res.headers()['content-disposition'] || '',
    bytes: (await res.body()).length,
  })
}

const checks = {
  rehan: /Rehan Abrar/.test(listText),
  ubaid: /Ubaid Ur Rehmaan Dar/.test(listText),
  mustafa: /Muhammad Mustafa/.test(listText),
  scores: (listText.match(/\b\d{1,3}(?:\.\d)?\b/g) || []).length >= 3,
  resume_links: links.length,
  all_links_fetch: fetched.length > 0 && fetched.every((f) => f.status === 200 && f.bytes > 5000),
}

console.log('URL:', page.url())
console.log('CHECKS:', JSON.stringify(checks, null, 1))
console.log('FILES:', JSON.stringify(fetched, null, 1))
console.log('ERRORS:', errors.length ? errors.slice(0, 6) : 'none')
await browser.close()
process.exit(errors.length === 0 && checks.all_links_fetch ? 0 : 1)
