import { expect, type Page } from "@playwright/test"

export const NAME = "Test Patient"

// From the landing page to the first question, entering the patient's name
export async function startAssessment(page: Page, name = NAME) {
  await page.goto("/")
  await page.getByRole("button", { name: /start the assessment/i }).click()
  await page.getByPlaceholder("Full name").fill(name)
  await page.getByRole("button", { name: /^next/i }).click()
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("How old is the patient?")
}

// Answers the current question with the first option (or just moves on, for a number) and waits for the next one
export async function answerCurrent(page: Page) {
  const heading = page.getByRole("heading", { level: 2 })
  const before = await heading.textContent()
  const option = page.locator("[role=option], [role=checkbox]").first()
  if (await option.count()) {
    await option.click()
    if ((await option.getAttribute("role")) === "checkbox") await page.getByRole("button", { name: /^(next|finish)/i }).click()
  } else {
    await page.getByRole("button", { name: /^(next|finish)/i }).click()
  }
  await expect(heading).not.toHaveText(before ?? "")
}

// Answers all 11 questions, leaving the page on the optional-results screen
export async function answerAll(page: Page) {
  for (let i = 0; i < 11; i++) await answerCurrent(page)
  await expect(page.getByRole("heading", { level: 2 })).toContainText("Any other test results")
}

export async function reachResults(page: Page, name = NAME) {
  await startAssessment(page, name)
  await answerAll(page)
  await page.getByRole("button", { name: /see my results/i }).click()
  await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(/chance of narrowed|signs of narrowed/, { timeout: 15_000 })
}
