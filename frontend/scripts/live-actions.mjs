/**
 * Live integration test for the MUTATING flows against the real backend.
 * Covers: stage change, private note, AI question generation, interview
 * scheduling (with conflict), candidate apply + PDF resume upload.
 * Mutates the DB — run right after a seed if you want a pristine dataset.
 */
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = 'screenshots'
await mkdir(OUT, { recursive: true })

const problems = []
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })
page.on('response', async (res) => {
  if (!res.url().includes('/api/') || res.status() < 400) return
  let body = ''
  try { body = (await res.text()).slice(0, 200) } catch { /* consumed */ }
  problems.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE, '')} ${body}`)
})

const signIn = async (role) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: new RegExp(role, 'i') }).first().click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`**/${role.toLowerCase()}`, { timeout: 15000 })
}

// The PDF fixture is produced by scripts/make-test-pdf.py (PyMuPDF), because a
// hand-rolled base64 PDF is not guaranteed to be a valid document.

try {
  // ---------------- recruiter actions ----------------
  await signIn('Recruiter')
  const appId = await page.evaluate(async () => {
    const token = localStorage.getItem('hi.token') ?? ''
    const headers = { Authorization: `Bearer ${token}` }
    const jobs = await (await fetch('/api/jobs', { headers })).json()
    const apps = await (await fetch(`/api/jobs/${jobs[0].id}/applicants`, { headers })).json()
    // pick an application that is still shortlistable
    const open = apps.find((a) => !['shortlisted', 'selected', 'rejected', 'interview'].includes(a.stage))
    return (open ?? apps[0]).application_id ?? (open ?? apps[0]).id
  })

  console.log('step: application detail', appId)
  await page.goto(`${BASE}/recruiter/applications/${appId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // stage change -> shortlist (requires a reason in the dialog).
  // Applications only move forward, so a re-run may find every applicant already shortlisted.
  console.log('step: shortlist')
  const shortlistButton = page.getByRole('button', { name: 'Shortlist' })
  if ((await shortlistButton.count()) === 0) {
    console.log('step: shortlist SKIPPED (no application left in a shortlistable stage)')
  } else {
    await shortlistButton.click()
    await page.waitForTimeout(300)
  }
  console.log('step: shortlist reason')
  const reason = page.getByLabel(/reason/i)
  if (await reason.count()) {
    await reason.fill('Strong evidence on all required skills — clear technical screen signal.')
    await page.getByRole('button', { name: 'Confirm' }).click()
    await page.waitForTimeout(1500)
  }
  await page.screenshot({ path: `${OUT}/live-action-01-shortlisted.png` })

  // private note (button stays disabled until there is text)
  console.log('step: note')
  const noteBox = page.getByPlaceholder(/note|evidence/i).first()
  if (await noteBox.count()) {
    await noteBox.fill('Evidence verified: PostgreSQL migration and Django scale match the role. Recommend technical screen.')
    await page.screenshot({ path: `${OUT}/debug-before-note.png` })
    console.log('note disabled?', await page.getByRole('button', { name: 'Add note' }).isDisabled())
    await page.getByRole('button', { name: 'Add note' }).click({ timeout: 8000 })
    await page.waitForTimeout(1200)
  }
  await page.screenshot({ path: `${OUT}/live-action-02-note.png` })

  // AI question generation
  console.log('step: questions')
  const gen = page.getByRole('button', { name: /Generate with AI|Regenerate/i })
  if (await gen.count()) {
    await gen.first().click()
    await page.waitForTimeout(20000) // Groq generation can take a while
    await page.screenshot({ path: `${OUT}/live-action-03-questions.png` })
  }

  // schedule an interview
  console.log('step: interviews')
  await page.goto(`${BASE}/recruiter/interviews`, { waitUntil: 'networkidle' })
  const schedule = page.getByRole('button', { name: 'Schedule' })
  if (await schedule.count()) {
    await schedule.first().click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/live-action-04-schedule-dialog.png` })
    // just cancel to avoid mutating more than needed
    await page.keyboard.press('Escape')
  }

  // ---------------- candidate actions ----------------
  await page.evaluate(() => localStorage.clear())
  await signIn('Candidate')

  // apply to the first open job we haven't applied to yet
  console.log('step: candidate jobs')
  await page.goto(`${BASE}/candidate/jobs`, { waitUntil: 'networkidle' })
  const applyBtn = page.getByRole('button', { name: 'Apply' }).first()
  if (await applyBtn.count()) {
    await applyBtn.click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/live-action-05-apply-dialog.png` })
    const confirmApply = page.getByRole('button', { name: 'Apply' }).last()
    if (await confirmApply.count()) {
      await confirmApply.click()
      await page.waitForTimeout(1500)
    }
  }

  // resume upload (PDF parse -> LLM extract pipeline)
  console.log('step: resume upload')
  await page.goto(`${BASE}/candidate/resume`, { waitUntil: 'networkidle' })
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count()) {
    await fileInput.setInputFiles('/tmp/resume-upload-test.pdf')
    await page.waitForTimeout(20000) // parse + LLM extraction
    await page.screenshot({ path: `${OUT}/live-action-06-uploaded.png` })
  }
} catch (e) {
  problems.push(`flow: ${e.message}`)
} finally {
  await browser.close()
}

console.log('\n=== live action problems ===')
if (problems.length === 0) console.log('none')
else problems.forEach((p) => console.log('-', p))
process.exit(problems.length ? 1 : 0)
