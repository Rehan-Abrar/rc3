// Landing page verification: real Chrome, real interactions, screenshots.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5190'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = 'screenshots/landing'
mkdirSync(OUT, { recursive: true })

const problems = []
const results = {}
const browser = await chromium.launch({ executablePath: CHROME })

async function open(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...opts })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && problems.push(`console ${width}: ${m.text()}`))
  page.on('pageerror', (e) => problems.push(`pageerror ${width}: ${e.message}`))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  return { ctx, page }
}

// 1440: structure, CTAs, images, interactions, screenshots
{
  const { ctx, page } = await open(1440, 900)
  results.title = await page.title()
  results.h1 = await page.locator('h1').innerText()
  results.ctas = await page.$$eval('a', (as) =>
    as
      .map((a) => ({ text: a.innerText.trim().replace(/\s+/g, ' '), href: a.getAttribute('href') }))
      .filter((a) => a.href && a.text)
  )
  results.images = await page.$$eval('img', (imgs) =>
    imgs.map((i) => ({ src: i.getAttribute('src'), complete: i.complete, w: i.naturalWidth }))
  )
  results.overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }))

  const sections = ['#how', '#evidence', '#fairness', '#console', '#candidates']
  for (const sel of sections) {
    const el = page.locator(sel)
    await el.scrollIntoViewIfNeeded()
    await page.waitForTimeout(900)
    await el.screenshot({ path: `${OUT}/desk-${sel.slice(1)}.png` })
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/desk-close.png` })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/desk-hero.png` })

  // requirement tabs change the evidence
  const before = await page.locator('.land-scan__quote').innerText()
  await page.locator('.land-scan__tab').nth(1).click()
  await page.waitForTimeout(500)
  const after = await page.locator('.land-scan__quote').innerText()
  results.tabSwitch = { changed: before !== after, selected: await page.locator('.land-scan__tab').nth(1).getAttribute('aria-selected') }

  // pipeline stage changes the panel
  await page.locator('#how').scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  const stageBefore = await page.locator('#stage-panel').innerText()
  await page.locator('.land-pipeline__stage').nth(5).click()
  await page.waitForTimeout(500)
  const stageAfter = await page.locator('#stage-panel').innerText()
  results.stageSwitch = { changed: stageBefore !== stageAfter, selected: await page.locator('.land-pipeline__stage').nth(5).getAttribute('aria-selected') }

  // keyboard: arrow moves the requirement tab
  await page.locator('.land-scan__tab').nth(0).focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  results.keyboardTab = await page.locator('.land-scan__tab').nth(1).getAttribute('aria-selected')

  await ctx.close()
}

// reduced motion: content must be visible, no scanline
{
  const { ctx, page } = await open(1440, 900, { reducedMotion: 'reduce' })
  results.reduced = await page.evaluate(() => {
    const h1 = document.querySelector('h1')
    const reveal = document.querySelector('.reveal')
    const scan = document.querySelector('.land-scan__scanline')
    return {
      h1Visible: h1.getBoundingClientRect().height > 0 && getComputedStyle(h1).opacity === '1',
      revealOpacity: reveal ? getComputedStyle(reveal).opacity : null,
      scanlineHidden: scan ? getComputedStyle(scan).display === 'none' : null,
    }
  })
  await page.screenshot({ path: `${OUT}/desk-reduced-motion.png` })
  await ctx.close()
}

// phone
{
  const { ctx, page } = await open(390, 844)
  results.mobileOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }))
  await page.screenshot({ path: `${OUT}/mobile-hero.png` })
  await page.locator('#how').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/mobile-how.png` })
  await page.locator('#evidence').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/mobile-evidence.png` })
  await page.locator('#fairness').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/mobile-fairness.png` })
  await page.locator('#console').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/mobile-console.png` })
  await page.locator('#candidates').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/mobile-candidates.png` })
  await ctx.close()
}

// tablet + laptop overflow
for (const width of [375, 768, 1024, 1280]) {
  const { ctx, page } = await open(width, 900)
  const o = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, inner: window.innerWidth }))
  results[`overflow_${width}`] = o
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 1))
console.log('PROBLEMS', problems.length ? problems : 'none')
