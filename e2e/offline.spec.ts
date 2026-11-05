import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_SUPABASE === "1", "Offline specs assume Supabase is not configured");

test.describe("public pages", () => {
  test("landing page explains SPACIO and is clearly unofficial", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/not an official SRM service/i).first()).toBeVisible();
    await page.getByRole("link", { name: /sign in with college email/i }).click();
    // The first visit compiles /login in dev mode, which can take a while.
    await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
  });

  test("no horizontal scrolling on the landing and login pages", async ({ page }) => {
    for (const path of ["/", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("login", () => {
  test("rejects emails outside the allowed domain", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("College email").fill("someone@gmail.com");
    await page.getByRole("button", { name: /send sign-in code/i }).click();
    await expect(page.getByText(/srmist\.edu\.in/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("rejects look-alike domains on the server too (JS disabled)", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("College email").fill("someone@srmist.edu.in.evil.com");
    await page.getByRole("button", { name: /send sign-in code/i }).click();
    await expect(page.getByText(/Use your SRM student email/i)).toBeVisible();
    await context.close();
  });

  test("a valid address explains that the backend isn't connected", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("College email").fill("ab1234@srmist.edu.in");
    await page.getByRole("button", { name: /send sign-in code/i }).click();
    await expect(page.getByText(/isn.t connected to Supabase/i)).toBeVisible();
  });
});

test.describe("protected routes", () => {
  for (const path of ["/home", "/explore", "/bookings", "/scan", "/profile", "/admin", "/admin/qr"]) {
    test(`${path} is not reachable without signing in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("cron endpoint requires the secret", async ({ request }) => {
    expect((await request.get("/api/cron/sweep")).status()).toBe(401);
    expect((await request.get("/api/cron/sweep", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  });

  test("assistant API refuses when no OpenRouter key is configured", async ({ request }) => {
    const res = await request.post("/api/assistant", { data: { messages: [{ role: "user", content: "hi" }] } });
    expect(res.status()).toBe(503);
    expect((await res.json()).error).toMatch(/OPENROUTER_API_KEY/);
  });

  test("landing page hides Nook when no OpenRouter key is configured", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /ask nook/i })).toHaveCount(0);
  });

  test("unknown pages show a helpful 404", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /doesn.t exist/i })).toBeVisible();
  });
});
