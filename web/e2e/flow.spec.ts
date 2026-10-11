import { expect, test } from "./fixtures"
import { answerCurrent, answerAll, holdResult, NAME, reachResults, scalesOver, startAssessment } from "./helpers"

test("the landing heart has no labels and no patient data @heart", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Coronary risk")
  await expect(page.locator(".heart-stage canvas")).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(".heart-stage .vessel-label:visible")).toHaveCount(0)
  await expect(page.getByText(/%/).filter({ hasText: /^(LAD|LCX|RCA)/ })).toHaveCount(0)
})

test("a full assessment reaches the results, and is honest about what was entered", async ({ page }) => {
  await reachResults(page)
  await expect(page.getByText(/you answered all 11 questions/i)).toBeVisible()
  await expect(page.getByText(/how far to trust each artery/i)).toBeVisible()
})

test("the results are labelled with the patient's name, and the heart carries the three artery labels @heart", async ({ page }) => {
  await reachResults(page)
  await expect(page.getByText(`${NAME}, `)).toBeVisible()
  await expect(page.locator(".heart-stage .vessel-label:visible")).toHaveCount(3, { timeout: 30_000 })
})

test("answers marked Not sure are reported as assumed", async ({ page }) => {
  await startAssessment(page)
  const heading = page.getByRole("heading", { level: 2 })
  for (let i = 0; i < 11; i++) {
    const unsure = page.getByRole(i < 2 ? "option" : "option", { name: /^not sure/i }).or(page.getByRole("checkbox", { name: /^not sure/i })).or(page.getByRole("button", { name: /^not sure/i }))
    const before = await heading.textContent()
    if (i >= 5 && (await unsure.count())) {
      await unsure.first().click()
      await expect(heading).not.toHaveText(before ?? "")
    } else {
      await answerCurrent(page)
    }
  }
  await page.getByRole("button", { name: /see my results/i }).click()
  await expect(page.getByText(/you answered \d+ of 11 questions/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/less reliable/i).first()).toBeVisible()
})

test("an out-of-range optional result is flagged on the field and on the results page", async ({ page }) => {
  await startAssessment(page)
  await answerAll(page)
  for (const trigger of await page.locator("[data-slot=accordion-trigger]").all()) {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click()
  }
  const row = page.locator(".form-row", { hasText: "Triglycerides" })
  const field = row.getByRole("textbox")
  await field.fill("")
  await field.pressSequentially("9000")
  await expect(row.getByRole("alert")).toContainText("Outside the range")
  await field.fill("")
  await field.pressSequentially("1e5")
  await expect(field).toHaveValue("15")
  await field.fill("9000")
  await page.getByRole("button", { name: /see my results/i }).click()
  await expect(page.getByText(/treat this result with extra caution/i)).toBeVisible({ timeout: 15_000 })
})

test("an unreachable server gives a message you can act on", async ({ page }) => {
  await startAssessment(page)
  await answerAll(page)
  await page.route("**/api/predict", (route) => route.abort())
  await page.getByRole("button", { name: /see my results/i }).click()
  await expect(page.getByRole("alert").filter({ hasText: /could not reach the server/i })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Any other test results")
})

test("while the result is worked out, the wordmark beats: it contracts and expands", async ({ page }) => {
  await startAssessment(page)
  await answerAll(page)
  const release = await holdResult(page)
  await page.getByRole("button", { name: /see my results/i }).click()
  await expect(page.locator(".loader-mark")).toBeVisible()
  await page.waitForTimeout(900)                       // the strokes have been written; the beat starts
  const seen = await scalesOver(page, 2300)            // two beats
  release()
  expect(Math.min(...seen), "it contracts").toBeLessThan(0.97)
  expect(Math.max(...seen), "it expands past rest").toBeGreaterThan(1.03)
})

test.describe("the header logo", () => {
  // The About page has the same header and no 3D heart, so nothing else is competing for the processor while the
  // logo's animation is timed (on the landing page the heart does, and on a slow machine that slows everything).
  const openAbout = async (page: import("@playwright/test").Page) => {
    await page.goto("/")
    await page.getByRole("button", { name: "about" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About Tria")
  }
  const scaleOf = (page: import("@playwright/test").Page) => page.locator("#logo-btn svg").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)
  const sample = async (page: import("@playwright/test").Page, ms = 1600) => {
    const seen: number[] = []
    for (let t = 0; t < ms; t += 40) { seen.push(await scaleOf(page)); await page.waitForTimeout(40) }
    return seen
  }

  test("is still until the pointer is on it, beats while it is, and finishes its beat on leaving", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover is a pointer thing")
    await openAbout(page)
    expect(new Set(await sample(page, 300)).size, "still at first").toBe(1)
    await page.locator("#logo-btn").hover()
    const hovered = await sample(page)
    expect(Math.min(...hovered), "contracts").toBeLessThan(0.95)
    expect(Math.max(...hovered), "expands past rest").toBeGreaterThan(1.03)
    await page.mouse.move(700, 400)                                             // leave
    await page.waitForTimeout(1500)                                             // the beat in progress finishes
    expect(await scaleOf(page), "back at rest, and stays there").toBe(1)
    expect(new Set(await sample(page, 400)).size).toBe(1)
  })

  test("leaving in the middle of a contraction does not snap back", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover is a pointer thing")
    await openAbout(page)
    const logo = page.locator("#logo-btn svg")
    const clock = () => logo.evaluate((el) => { const a = el.getAnimations()[0]; return a ? { t: Number(a.currentTime), state: a.playState } : null })
    await page.locator("#logo-btn").hover()
    await expect.poll(async () => (await clock())?.t ?? -1, { timeout: 4000 }).toBeGreaterThan(80)     // a little way into the first beat
    const before = (await clock())!
    await page.mouse.move(700, 400)                                                                        // leave, mid-beat
    const right = await clock()
    // the beat is still there and still running, carrying on from where it was: it has not restarted or been cut off
    expect(right, "the animation survives leaving").not.toBeNull()
    expect(right!.state).toBe("running")
    expect(right!.t, "carries on, no restart").toBeGreaterThanOrEqual(before.t)
    // it ends at the end of that beat (1.15 s), and the logo is then at rest
    await expect.poll(async () => await clock(), { timeout: 3000 }).toBeNull()
    expect(await scaleOf(page)).toBe(1)
  })

  test("beats when it has keyboard focus", async ({ page, isMobile }) => {
    test.skip(isMobile, "no keyboard")
    await page.goto("/")                                                        // tabbing starts from the top of the page, so not the About page
    await page.keyboard.press("Tab")                                            // the skip link
    await page.keyboard.press("Tab")                                            // the logo
    await expect(page.locator("#logo-btn")).toBeFocused()
    const seen = await sample(page)
    expect(Math.min(...seen)).toBeLessThan(0.95)
  })

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" })
    test("does not move", async ({ page, isMobile }) => {
      test.skip(isMobile, "hover is a pointer thing")
      await openAbout(page)
      await page.locator("#logo-btn").hover()
      expect(new Set(await sample(page, 800)).size).toBe(1)
    })
  })
})

test("a value the server refuses is explained", async ({ page }) => {
  await startAssessment(page)
  await answerAll(page)
  await page.route("**/api/predict", (route) => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ detail: "Age cannot be negative" }) }))
  await page.getByRole("button", { name: /see my results/i }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Age cannot be negative" })).toBeVisible({ timeout: 10_000 })
})

test("the heart squeezes with the beat, and is printed relaxed whatever the moment @heart", async ({ page }) => {
  await reachResults(page)
  const stage = page.locator(".heart-stage")
  await expect(stage.locator(".vessel-label:visible")).toHaveCount(3, { timeout: 15_000 })
  await page.getByRole("button", { name: /heartbeat/i }).click()                      // stop the beat, then hold it by hand
  const hold = async (squeeze: number) => { await stage.evaluate((el: any, s) => el.__viewer.freezeAt(s), squeeze); await page.waitForTimeout(400) }
  await hold(0)
  const relaxed = await stage.screenshot()
  await hold(1)
  const squeezed = await stage.screenshot()
  expect(Buffer.compare(relaxed, squeezed), "a full squeeze must look different from rest").not.toBe(0)
  await expect(stage.locator(".vessel-label:visible")).toHaveCount(3)                  // the labels survive the squeeze
  // what goes into the PDF is the relaxed heart, not whatever moment the button was pressed at
  const printedAtRest = await stage.evaluate((el: any) => { el.__viewer.freezeAt(0); return el.__viewer.snapshot() })
  await hold(1)
  const printedSqueezed = await stage.evaluate((el: any) => el.__viewer.snapshot())
  expect(printedSqueezed).toBe(printedAtRest)
})

test("the light mode keeps the heart whole: the same labels, a picture that is not blank, and clicking still works @heart", async ({ page }) => {
  await reachResults(page)
  const stage = page.locator(".heart-stage")
  await expect(stage.locator(".vessel-label:visible")).toHaveCount(3, { timeout: 30_000 })
  await page.getByRole("button", { name: /heartbeat/i }).click()
  await stage.evaluate((el: any) => el.__viewer.setQuality("full"))
  await page.waitForTimeout(800)
  const full = await stage.screenshot()
  await stage.evaluate((el: any) => el.__viewer.setQuality("lite"))
  await page.waitForTimeout(800)
  expect(await stage.evaluate((el: any) => el.__viewer.quality())).toBe("lite")
  const lite = await stage.screenshot()
  expect(Buffer.compare(full, lite), "the light mode changes the finish").not.toBe(0)
  expect(lite.length, "and is a real picture, not a blank frame").toBeGreaterThan(20_000)
  await expect(stage.locator(".vessel-label:visible")).toHaveCount(3)
  await stage.locator(".vessel-label", { hasText: "LAD" }).click()
  await expect(stage.locator(".vessel-label.selected")).toContainText("LAD")
})

test("Save PDF produces a real report with the name and the hand-drawn wordmark @heart", async ({ page }) => {
  await reachResults(page, "Jane Rivera")
  await expect(page.locator(".heart-stage .vessel-label:visible")).toHaveCount(3, { timeout: 15_000 })
  const download = page.waitForEvent("download", { timeout: 30_000 })
  await page.getByRole("button", { name: /save pdf/i }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^tria-jane-rivera-\d{4}-\d{2}-\d{2}\.pdf$/)
  const path = await file.path()
  const bytes = (await import("node:fs")).readFileSync(path)
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-")
  expect(bytes.length).toBeGreaterThan(20_000)                       // the heart image is in there
  const text = bytes.toString("latin1")
  expect(text).toContain("Jane Rivera")
  expect(text).toContain("Coronary artery disease risk report")
  expect(text).not.toContain("flowstate")
})

test("every question screen fits the screen width and its drawing fits its frame", async ({ page }) => {
  await startAssessment(page)
  for (let i = 0; i < 11; i++) {
    const title = (await page.getByRole("heading", { level: 2 }).textContent()) ?? ""
    const problems = await page.evaluate(() => {
      const doc = document.documentElement
      const svg = document.querySelector("main svg.illus")!
      const box = svg.getBoundingClientRect()
      const texts = [...svg.querySelectorAll("text")].filter((t) => { const r = t.getBoundingClientRect(); return r.right > box.right + 1 || r.left < box.left - 1 })
      const cramped = [...svg.querySelectorAll("text")].filter((t) => t.getBoundingClientRect().height < 6.5)
      return { overflowX: doc.scrollWidth > innerWidth, clipped: texts.map((t) => t.textContent), cramped: cramped.map((t) => t.textContent), width: Math.round(box.width) }
    })
    expect(problems.overflowX, `${title}: horizontal overflow`).toBe(false)
    expect(problems.clipped, `${title}: text outside its drawing`).toEqual([])
    expect(problems.width, `${title}: drawing too small to read`).toBeGreaterThan(200)
    await answerCurrent(page)
  }
})

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" })
  test("the loader holds still", async ({ page }) => {
    await startAssessment(page)
    await answerAll(page)
    const release = await holdResult(page)
    await page.getByRole("button", { name: /see my results/i }).click()
    await expect(page.locator(".loader-mark")).toBeVisible()
    await page.waitForTimeout(500)
    const scales = await scalesOver(page, 800)
    release()
    expect(new Set(scales).size).toBe(1)
  })
  test("no illustration is animated", async ({ page }) => {
    await startAssessment(page)
    for (let i = 0; i < 10; i++) {
      const still = await page.evaluate(() => {
        const svg = document.querySelector("main svg.illus")!
        const running = document.getAnimations().filter((a) => a.playState === "running" && svg.contains((a.effect as KeyframeEffect).target)).length
        return { running, smil: svg.querySelectorAll("animate, animateTransform, animateMotion").length }
      })
      expect(still.running, "CSS animations still running").toBe(0)
      expect(still.smil, "SVG animations present").toBe(0)
      await answerCurrent(page)
    }
  })
})

test.describe("clicking the arteries on the heart @heart", () => {
  for (const artery of ["LAD", "LCX", "RCA"] as const) {
    test(`a click on or near the ${artery} selects it, its label and its muscle`, async ({ page }) => {
      await reachResults(page)
      const stage = page.locator(".heart-stage")
      await expect(stage.locator(".vessel-label:visible")).toHaveCount(3, { timeout: 15_000 })
      await page.getByRole("button", { name: /heartbeat/i }).click()             // hold still
      // the camera starts from the front; bring the artery into view first, as a person would turn the heart
      await stage.evaluate((el: any, a) => el.__viewer.lookFrom(...({ LAD: [0.9, 0.1, 0.6], LCX: [1, 0.2, -0.2], RCA: [-0.9, -0.2, 0.7] } as any)[a]), artery)
      // wait until the artery has stopped moving on screen (the camera eases to a stop, and a busy machine takes longer)
      const where = () => stage.evaluate((el: any, a) => el.__viewer.screenPointOf(a), artery)
      let at = await where()
      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(150)
        const next = await where()
        const still = at && next && Math.hypot(next.x - at.x, next.y - at.y) < 0.5
        at = next
        if (still) break
      }
      expect(at, `${artery} has a visible point`).toBeTruthy()
      // a click right on the artery, and a click a few pixels beside it (on the fat or the muscle next to it).
      // The figure is measured again before each click: on a phone the page scrolls, and an old position would miss.
      for (const [dx, dy] of [[0, 0], [7, 5]]) {
        at = await where()
        let box = (await stage.boundingBox())!
        await page.mouse.click(box.x + at.x + dx, box.y + at.y + dy)
        await expect(stage.locator(`.vessel-label.selected`)).toContainText(artery)
        await expect(stage.locator(`.vessel-label.dim`)).toHaveCount(2)
        // a click on empty space deselects: find a spot a good way from every artery (a click near one rightly selects it)
        const empty = await stage.evaluate((el: any) => {
          const r = el.querySelector("canvas").getBoundingClientRect()
          let best = { x: 6, y: 6, d: -1 }
          for (let gx = 0.04; gx < 1; gx += 0.1) for (let gy = 0.04; gy < 1; gy += 0.1) {
            const d = el.__viewer.distanceToArteries(r.width * gx, r.height * gy)
            // and bare canvas: the floating labels are buttons, and a click on one selects its artery
            const top = document.elementFromPoint(r.left + r.width * gx, r.top + r.height * gy)
            if (d > best.d && top === el.querySelector("canvas")) best = { x: r.width * gx, y: r.height * gy, d }
          }
          return best
        })
        expect(empty.d, "there is empty space on the figure").toBeGreaterThan(40)
        box = (await stage.boundingBox())!
        await page.mouse.click(box.x + empty.x, box.y + empty.y)
        await expect(stage.locator(".vessel-label.selected")).toHaveCount(0)
      }
    })
  }

  test("clicking a heart that is beating still selects the artery under the pointer", async ({ page }) => {
    await reachResults(page)
    const stage = page.locator(".heart-stage")
    await expect(stage.locator(".vessel-label:visible")).toHaveCount(3, { timeout: 15_000 })
    // the beat is left ON: the surface is moving by up to ~15 px, and the click has to follow it
    await stage.evaluate((el: any) => el.__viewer.lookFrom(0.9, 0.1, 0.6))
    await page.waitForTimeout(1500)
    // find the artery and click it in the same instant, as a pointer would: the heart moves ~10 px in 100 ms, so a
    // click aimed 100 ms earlier would miss for a reason that is the test's, not the heart's
    let hits = 0
    for (let i = 0; i < 12; i++) {
      const picked = await stage.evaluate((el: any) => {
        const at = el.__viewer.screenPointOf("LAD")
        const canvas = el.querySelector("canvas") as HTMLCanvasElement
        const r = canvas.getBoundingClientRect()
        const send = (type: string) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + at.x, clientY: r.top + at.y, pointerType: "mouse", isPrimary: true, button: 0 }))
        send("pointerdown"); send("pointerup")
        return el.querySelector(".vessel-label.selected")?.textContent ?? ""
      })
      if (/LAD/.test(picked)) hits++
      await stage.evaluate((el: any) => { const c = el.querySelector("canvas"); const r = c.getBoundingClientRect(); for (const t of ["pointerdown", "pointerup"]) c.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: r.left + 6, clientY: r.bottom - 6, pointerType: "mouse", isPrimary: true, button: 0 })) })
      await page.waitForTimeout(170)                                  // a different moment of the beat each time
    }
    expect(hits, "clicks on the beating LAD that selected it").toBeGreaterThanOrEqual(11)
  })

  test("Risk map colours each territory in its artery's colour, and selecting one leads it", async ({ page }) => {
    await reachResults(page)
    const stage = page.locator(".heart-stage")
    await expect(stage.locator(".vessel-label:visible")).toHaveCount(3, { timeout: 15_000 })
    await page.getByRole("button", { name: /heartbeat/i }).click()
    const frame = async () => { await page.waitForTimeout(500); return stage.screenshot() }
    const plain = await frame()
    await page.getByRole("button", { name: /colour the heart muscle/i }).click()
    const mapped = await frame()
    expect(Buffer.compare(plain, mapped), "Risk map changes the picture").not.toBe(0)
    await stage.locator(".vessel-label", { hasText: "RCA" }).click()
    const selected = await frame()
    expect(Buffer.compare(mapped, selected), "selecting an artery changes the picture").not.toBe(0)
    await page.getByRole("button", { name: /colour the heart muscle/i }).click()   // map off: only the selected territory stays painted
    const only = await frame()
    expect(Buffer.compare(selected, only), "turning the map off keeps the selection but drops the others").not.toBe(0)
  })
})
