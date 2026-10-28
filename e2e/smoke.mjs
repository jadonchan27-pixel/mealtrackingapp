// Smoke test of the live app (build step 20), on a phone and a desktop
// screen. It only reads: every page loads signed in, with no errors, and
// the read-only API routes answer. The steps that write (finalizing a week,
// confirming a meal, logging a weight) are done by hand; see docs/DEPLOY.md.
//
//   npm run smoke:login -- https://<app>.vercel.app   (once)
//   npm run smoke -- https://<app>.vercel.app

import { existsSync } from "node:fs";
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const STATE = "e2e/.auth.json";
if (!existsSync(STATE)) {
  console.error(`No ${STATE}. Run: npm run smoke:login -- ${base}`);
  process.exit(1);
}

// Austin's date, as the app uses it.
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Chicago",
});

const PAGES = [
  { path: "/", heading: "Today" },
  { path: "/plan", heading: "Plan" },
  { path: "/plan/batches", heading: "Batch cooking" },
  { path: "/shopping", heading: "Shopping" },
  { path: "/weight", heading: "Weight" },
  { path: "/profile", heading: "Profile" },
];

const APIS = [
  "/api/profile",
  "/api/targets",
  "/api/weights",
  `/api/log?date=${today}`,
];

const SCREENS = {
  phone: devices["iPhone 13"],
  desktop: { viewport: { width: 1280, height: 800 } },
};

let failures = 0;
function report(ok, label, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
for (const [screen, options] of Object.entries(SCREENS)) {
  const context = await browser.newContext({ ...options, storageState: STATE });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  for (const { path, heading } of PAGES) {
    errors.length = 0;
    const res = await page.goto(new URL(path, base).href);
    const signedOut = new URL(page.url()).pathname === "/sign-in";
    const h1 = await page
      .locator("h1")
      .first()
      .textContent({ timeout: 10_000 })
      .catch(() => null);
    // Wait for streamed sections to finish loading.
    await page
      .getByText("Loading…")
      .first()
      .waitFor({ state: "detached", timeout: 30_000 })
      .catch(() => {});
    const alert = await page
      .getByRole("alert")
      .first()
      .textContent({ timeout: 500 })
      .catch(() => null);
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    const problems = [
      res && !res.ok() && `HTTP ${res.status()}`,
      signedOut && "sent to sign-in (run smoke:login again)",
      h1?.trim() !== heading && `heading "${h1}"`,
      alert && `alert "${alert.trim()}"`,
      errors.length > 0 && `script error "${errors[0]}"`,
      wide && "scrolls sideways",
    ].filter(Boolean);
    report(problems.length === 0, `${screen} ${path}`, problems.join(", "));
  }

  if (screen === "desktop") {
    for (const api of APIS) {
      const res = await context.request.get(new URL(api, base).href);
      report(res.ok(), `GET ${api}`, res.ok() ? "" : `HTTP ${res.status()}`);
    }
  }
  await context.close();
}
await browser.close();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
