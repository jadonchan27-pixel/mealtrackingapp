// Saves a signed-in browser session for the smoke test (build step 20).
// Opens a browser window on the app's sign-in page; Jadon signs in with
// Google himself, and the session is saved to e2e/.auth.json (gitignored).
// The script never sees or types a password.
//
//   npm run smoke:login -- https://<app>.vercel.app

import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(new URL("/sign-in", base).href);
console.log("Sign in with Google in the window that opened…");
// Signed in once the app shows its main navigation.
await page.waitForSelector('nav[aria-label="Main"]', { timeout: 5 * 60_000 });
await context.storageState({ path: "e2e/.auth.json" });
console.log("Saved the session to e2e/.auth.json.");
await browser.close();
