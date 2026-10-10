import { expect, test } from "@playwright/test"
import { answerCurrent, NAME, startAssessment } from "./helpers"

test.describe("the patient's name", () => {
  test("is required and cannot be skipped", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: /start the assessment/i }).click()
    await page.getByRole("button", { name: /^next/i }).click()
    await expect(page.getByRole("alert")).toContainText("Enter the patient's name")
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("What is the patient's name?")
  })

  test("takes letters only: digits and symbols are removed as you type", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: /start the assessment/i }).click()
    const field = page.getByPlaceholder("Full name")
    await field.pressSequentially("Anne-Marie O'Neil 2nd!")
    await expect(field).toHaveValue("Anne-Marie O'Neil nd")
    await expect(page.getByRole("alert")).toContainText("only contain letters")
  })

  test("digits alone do not count as a name", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: /start the assessment/i }).click()
    await page.getByPlaceholder("Full name").pressSequentially("12345")
    await page.getByRole("button", { name: /^next/i }).click()
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("What is the patient's name?")
  })
})

test.describe("a number question (age)", () => {
  test.beforeEach(async ({ page }) => { await startAssessment(page) })
  const age = (page: import("@playwright/test").Page) => page.getByRole("textbox", { name: /years/i })

  test("rejects letters and symbols", async ({ page }) => {
    await age(page).fill("")
    await age(page).pressSequentially("ab4c5!")
    await expect(age(page)).toHaveValue("45")
    await expect(page.getByRole("alert").first()).toContainText("Numbers only")
  })

  test("blocks Next for an out-of-range value, and says what range is allowed", async ({ page }) => {
    await age(page).fill("200")
    await age(page).blur()
    await expect(page.getByRole("alert").first()).toContainText("30 to 86")
    await page.getByRole("button", { name: /^next/i }).click()
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("How old is the patient?")
  })

  test("blocks Next for an empty value", async ({ page }) => {
    await age(page).fill("")
    await age(page).blur()
    await page.getByRole("button", { name: /^next/i }).click()
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("How old is the patient?")
    await expect(page.getByRole("alert").first()).toBeVisible()
  })

  test("a valid age moves on, and + stops at the maximum", async ({ page }) => {
    await age(page).fill("86")
    await page.getByRole("button", { name: /increase/i }).click()
    await expect(age(page)).toHaveValue("86")
    await expect(page.getByRole("alert").first()).toContainText("Maximum value is 86")
    await age(page).fill("64")
    await page.getByRole("button", { name: /^next/i }).click()
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Biological sex")
  })

  test("a choice question will not move on without an answer", async ({ page }) => {
    await answerCurrent(page)
    await page.getByRole("button", { name: /^next/i }).click()
    await expect(page.getByRole("alert")).toContainText("Choose an answer")
  })
})

test("the progress dots work from the keyboard", async ({ page }) => {
  await startAssessment(page)
  await answerCurrent(page)
  await answerCurrent(page)
  const dots = page.getByRole("slider", { name: "Question" })
  await expect(dots).toHaveAttribute("aria-valuenow", "3")
  await dots.focus()
  await page.keyboard.press("ArrowLeft")
  await expect(dots).toHaveAttribute("aria-valuenow", "2")
  await page.keyboard.press("Home")
  await expect(dots).toHaveAttribute("aria-valuenow", "1")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")           // cannot run ahead of the first unanswered question
  await expect(dots).toHaveAttribute("aria-valuenow", "3")
  expect(NAME).toBeTruthy()
})
