import { test as base, expect } from "@playwright/test"

// Tests whose title contains @heart need the 3D heart drawn. Every other test runs with the 3D bundle blocked (the app
// shows its pages without it): they test the questions, the validation, the messages and the animations, and need no
// 3D picture, which on a machine with no graphics card is what makes everything slow.
export const test = base.extend({
  // `provide` is Playwright's "use": it is not named `use` here only because the linter takes that for a React hook
  page: async ({ page }, provide, testInfo) => {
    if (!testInfo.titlePath.some((t) => t.includes("@heart"))) await page.route(/\/assets\/heart-[^/]+\.js/, (route) => route.abort())
    await provide(page)
  },
})
export { expect }
