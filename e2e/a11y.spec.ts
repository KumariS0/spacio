import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_SUPABASE === "1", "Runs against the offline pages");

/** WCAG 2.1 A/AA checks with axe-core on every page that renders without a backend. */
const PAGES = ["/", "/login", "/logged-out", "/forbidden", "/this-page-does-not-exist"];

for (const path of PAGES) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}

test("login error state has no violations", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("College email").fill("someone@gmail.com");
  await page.getByRole("button", { name: /send sign-in code/i }).click();
  await expect(page.getByText(/srmist\.edu\.in/i).first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
