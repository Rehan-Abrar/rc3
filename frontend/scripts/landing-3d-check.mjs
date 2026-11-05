import { chromium } from 'playwright-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const URL = 'http://localhost:5191/'
const out = 'screenshots/landing3d'

const browser = await chromium.launch({ executablePath: CHROME })
const errors = []
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const canvas = await page.evaluate(() => {
  const c = document.querySelector('.land-net canvas')
  if (!c) return null
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  return { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, gl: !!gl, renderer: gl ? gl.getParameter(gl.RENDERER) : null }
})
const panel = await page.locator('.land-net').boundingBox()
const h1 = await page.locator('.land-hero__title').evaluate((el) => {
  const s = getComputedStyle(el); const r = el.getBoundingClientRect()
  return { lines: Math.round(r.height / parseFloat(s.lineHeight)), font: s.fontSize, w: Math.round(r.width) }
})
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
await page.screenshot({ path: `${out}/desktop-fold.png` })
await page.screenshot({ path: `${out}/desktop-full.png`, fullPage: true })

// hover a signal label and confirm the readout follows it
const docker = page.locator('.land-net__pill', { hasText: 'Docker' }).first()
await docker.hover({ force: true })
await page.waitForTimeout(700)
const readout = await page.locator('.land-net__readout-head strong').innerText()
await page.screenshot({ path: `${out}/desktop-hover.png` })

// click a signal and confirm aria state + readout
const pg = page.locator('.land-net__pill', { hasText: 'PostgreSQL' }).first()
await pg.click({ force: true })
await page.waitForTimeout(600)
const clicked = await page.locator('.land-net__readout-head strong').innerText()
const pressed = await pg.getAttribute('aria-pressed')

// reduced motion
const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
await page2.goto(URL, { waitUntil: 'networkidle' })
await page2.waitForTimeout(2200)
const rmCanvas = await page2.locator('.land-net canvas').count()
const rmH1 = await page2.locator('.land-hero__title').evaluate((el) => getComputedStyle(el).opacity)
await page2.screenshot({ path: `${out}/desktop-reduced.png` })

// mobile
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
mobile.on('console', (m) => { if (m.type() === 'error') errors.push('mobile: ' + m.text()) })
await mobile.goto(URL, { waitUntil: 'networkidle' })
await mobile.waitForTimeout(2200)
const mOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const mCanvas = await mobile.locator('.land-net canvas').count()
await mobile.screenshot({ path: `${out}/mobile-fold.png` })
await mobile.screenshot({ path: `${out}/mobile-full.png`, fullPage: true })

console.log(JSON.stringify({ canvas, panel, h1, overflow, readout, clicked, pressed, rmCanvas, rmH1, mOverflow, mCanvas, errors }, null, 2))
await browser.close()
