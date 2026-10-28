# Step 5: MVP Build Plan

_Builds on [03-requirements.md](03-requirements.md) and [04-architecture.md](04-architecture.md)._

Rules for steps 6 and 7 of the framework:
- Implement **one step at a time**, and one subtask at a time when a step has several.
- Do only what the step says. Anything new goes into this plan first.
- Commit after each subtask. After each step, validate it (step 7) before starting the next.
- Logic in `lib/` gets Vitest unit tests in the same subtask.

🧑 marks a setup task Jadon does by hand (accounts, keys). Claude gives exact instructions when the step comes up.

Status: ☐ not started · ◐ in progress · ☑ done and validated

---

## Phase 1: Foundation

### ☐ Step 1. Project scaffold
1. Create the Next.js (App Router) TypeScript app with ESLint and Prettier.
2. Add Vitest with one sample test, and `npm test`, `npm run lint`, `npm run build` scripts.
3. Add a GitHub Actions workflow that runs lint, test and build on every push.

**Done when:** the app runs locally, CI is green on `main`.

### ☐ Step 2. Database
1. 🧑 Create a free Supabase project and share the URL and keys as environment variables (never committed).
2. Add `supabase/migrations/001_schema.sql` with every enum and table from the architecture doc.
3. Add row-level security policies (`user_id = auth.uid()`) to every table.
4. Add the Supabase client helpers in `lib/db/` and generated TypeScript types.

**Done when:** the migration applies cleanly and the types compile.

### ☐ Step 3. Google sign-in (US-1, US-2, TR-4, TR-5)
1. 🧑 Create Google OAuth credentials and enable the Google provider in Supabase.
2. Sign-in page and sign-out button.
3. Middleware: unauthenticated users go to sign-in; any email other than `ALLOWED_EMAIL` is signed out and refused.
4. Shared API helper that rejects requests without the allowed user.

**Done when:** Jadon can sign in; another Google account is refused.

### ☐ Step 4. App shell and PWA (US-3, TR-1, TR-2)
1. Responsive layout with navigation: Today, Plan, Shopping, Weight, Profile.
2. Web app manifest and icons.
3. Basic service worker so the app can be installed (no offline data yet).

**Done when:** the app installs to the phone home screen and works at phone and desktop widths.

## Phase 2: Profile, targets and weight

### ☐ Step 5. Targets logic (US-5, TR-10, TR-20)
1. `lib/units.ts`: lb↔kg, ft/in↔cm, and cooking unit conversions, with tests.
2. `lib/targets.ts`: BMR, TDEE, +300 surplus, protein, fat and carbs, with tests against worked examples.

**Done when:** tests pass for male and female examples at each activity level.

### ☐ Step 6. Profile (US-4, US-6)
1. `GET/PUT /api/profile` and `GET /api/targets`.
2. Profile page: form for age, sex, height, weight, activity; shows the targets.

**Done when:** saving the profile shows updated targets on phone and desktop.

### ☐ Step 7. Weight (US-26, US-27, TR-19)
1. `lib/trend.ts`: 3-entry moving average, with tests.
2. `GET/POST /api/weights`; posting also updates `profile.weight_lb`.
3. Weight page: log a weigh-in, Recharts chart of weigh-ins with the trend line.

**Done when:** a new weight shows on the chart and targets change.

## Phase 3: Recipes and nutrition

### ☐ Step 8. Ingredient parser (TR-7)
1. `lib/ingredients/parse.ts`: turns lines like "1 1/2 cups cooked rice, divided" into quantity, unit and food text. Handles fractions, ranges, unicode fractions and common units.
2. Tests with at least 40 real ingredient lines; unparseable lines return a clear "unparsed" result.

**Done when:** tests pass.

### ☐ Step 9. Nutrition (TR-8)
1. 🧑 Get a free USDA FoodData Central API key.
2. `lib/services/usda.ts`: search a food and fetch per-100 g nutrition and portion weights.
3. `foods` cache: look up by name first, call USDA only on a miss.
4. `lib/nutrition.ts`: convert parsed ingredients to grams and sum nutrition per serving, with tests (USDA mocked).

**Done when:** a sample recipe's nutrition is computed and cached foods are reused.

### ☐ Step 10. Recipe page reader (TR-6, TR-9)
1. `lib/services/recipePage.ts`: fetch a URL and extract the JSON-LD `Recipe` (title, photo, servings, ingredients, steps, prep/cook/total time).
2. Tests with saved HTML fixtures from a few recipe sites, including one with no recipe data.
3. Save the recipe, its ingredients (parsed with step 8) and nutrition (step 9) to the database.

**Done when:** a real recipe URL is stored with nutrition; pages without recipe data are skipped.

### ☐ Step 11. Recipe search and ranking (US-8, US-13, US-14, TR-11, TR-13)
1. 🧑 Get a free Brave Search API key.
2. `lib/services/braveSearch.ts`: query and return result URLs.
3. `lib/ranking.ts`: filter active time ≤ 60 min and last week's recipes; score by cuisine match, protein per 100 kcal and cost per serving, with tests.
4. Cost per serving uses `heb_products` (estimates are fine until step 15).

**Done when:** a function returns the top 3 ranked recipes for a cuisine and slot.

## Phase 4: Weekly plan

### ☐ Step 12. Draft plan and shortlist (US-7 to US-10)
1. `POST /api/weeks`, `GET /api/weeks/:weekStart`, `POST /api/weeks/:id/candidates` (one slot per request), `PATCH /api/candidates/:id`.
2. If no cuisine is given, the app picks one not used last week.
3. Plan page: choose cuisines for the coming week, run the search slot by slot, show 3 candidates per slot (photo, time, nutrition, ingredients), select or swap.
4. Recipe detail page (`GET /api/recipes/:id`).

**Done when:** Jadon can build a full shortlist and pick one recipe per slot.

### ☐ Step 13. Portion scaling and finalize (US-11, TR-12)
1. `lib/scaling.ts`: servings per day per slot (80/20 split, 0.25 rounding, protein top-up), with tests.
2. `POST /api/weeks/:id/finalize`: writes `plan_items` and a `log_entries` row for every day and slot (Sunday to Saturday).
3. Plan page shows the finalized week with daily totals vs targets.

**Done when:** a finalized plan's daily totals are within 5% of the calorie target.

### ☐ Step 14. Batch cooking view (US-12, TR-14)
1. `GET /api/weeks/:id/batches`: per-recipe quantities for the Sunday batch (×4 days) and Thursday batch (×3 days).
2. Batch page: each recipe with scaled ingredients and steps, for each batch.

**Done when:** batch quantities match servings per day × days.

## Phase 5: Shopping list

### ☐ Step 15. H-E-B price table (TR-16)
1. Seed `heb_products` with estimated H-E-B package sizes and prices for ~150 common ingredients.
2. When a new food has no product, create an estimated one (by section default price per gram).

**Done when:** every food used in a plan maps to a product.

### ☐ Step 16. Shopping list generation (US-15 to US-18, TR-15, TR-17)
1. `lib/shopping.ts`: sum grams per food across recipes and batches, round up to packages, set the batch flag, with tests.
2. Finalize (step 13) also writes `shopping_list_items`.
3. `GET /api/weeks/:id/shopping-list`: grouped by section, with total.

**Done when:** the list for a finalized plan shows packages, prices, batch marks and a total.

### ☐ Step 17. Shopping list page (US-19)
1. Shopping page grouped by section with checkboxes and total.
2. `PATCH /api/shopping-list/:id` for `checked` and `actualPriceCents`; the actual price updates `heb_products` (`is_estimate = false`).

**Done when:** checking items persists across devices and corrected prices show next week.

## Phase 6: Daily logging

### ☐ Step 18. Today page (US-20 to US-23, TR-18)
1. `GET /api/log?date=` with entries and confirmed totals.
2. `PATCH /api/log/:id` for status and portion.
3. Today page: each slot with tap-to-confirm, change portion, mark skipped; running totals vs targets.

**Done when:** only confirmed items count toward totals.

### ☐ Step 19. Eating out, manual (US-24, US-25)
1. `POST /api/log/restaurant`: marks the planned entry skipped and adds a restaurant entry.
2. Form on the Today page: restaurant, item, amount eaten, calories, protein, carbs, fat.

**Done when:** the restaurant item replaces the planned meal in the day's totals.

## Phase 7: Launch

### ☐ Step 20. Deploy
1. 🧑 Connect the repo to a free Vercel project and add the environment variables.
2. Update Supabase and Google OAuth redirect URLs for the Vercel domain.
3. Playwright smoke test of the full flow: sign in, profile, build and finalize a week, shopping list, confirm a meal, log a weight.

**Done when:** the full flow works on the live URL from phone and desktop.

---

Later versions (restaurant search, ratings, leftovers, auto-adjust, notifications, offline list, more charts) get their own build plan after the MVP is done.
