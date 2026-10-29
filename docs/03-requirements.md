# Step 3: Minimum Requirements

_Builds on [01-project-plan.md](01-project-plan.md) and the step 2 facet docs (`02-*.md`). Tech stack, schema and API design are decided in step 4._

## MVP scope

**In version 1**
1. Google login; installable web app for phone and desktop
2. Profile with calorie, protein, carb and fat targets
3. Weekly cuisine choice, recipe web search, nutrition calculated from ingredients
4. Saturday shortlist to approve or swap, then the weekly plan (meals + snacks, two batches)
5. Shopping list from H-E-B prices, rounded to package sizes, grouped by section, with a total
6. Tap to confirm meals; daily totals vs target
7. Weekly weigh-in and a weight trend chart
8. Eating out with manual entry only

**Later versions (not in MVP)**
- Restaurant search with nutrition estimates; saved restaurant items
- Moving skipped portions to another meal or day
- Ratings, liked-recipe library, ranking by ratings
- Leftover tracking; preferring previously used ingredients
- Auto-adjusting the calorie target
- Push notifications and reminders
- Offline shopping list
- Calorie, protein and weekly-average charts

## User stories (MVP)

### Login and app
- **US-1** As Jadon, I can sign in with my Google account so my data is private and synced across devices.
- **US-2** As Jadon, I am the only account allowed in; any other Google account is refused.
- **US-3** As Jadon, I can add the app to my phone's home screen and use it like an app, and use it in a desktop browser.

### Profile and targets
- **US-4** As Jadon, I can enter age, sex, height (ft/in), weight (lb) and activity level.
- **US-5** As Jadon, I can see my daily calorie target (Mifflin-St Jeor × activity + 300 kcal) and macro targets (protein 1 g/lb, fat ~25%, carbs the rest).
- **US-6** As Jadon, my targets recalculate when I change my profile or log a new weight.

### Weekly planning
- **US-7** As Jadon, on Saturday I can choose one or more cuisines for the coming week, or skip and let the app choose.
- **US-8** As Jadon, the app searches the web and shows a shortlist of candidate recipes each for breakfast, lunch, dinner and snack: every recipe that fits, best first, with the top 3 shown up front, the rest behind "Show all", and the best match pre-selected.
- **US-9** As Jadon, each candidate shows its photo, ingredients with portions, active cooking time and nutrition per serving.
- **US-10** As Jadon, I can approve each pick or swap it for another candidate, then finalize the week's plan.
- **US-11** As Jadon, the finalized plan gives me the same breakfast, lunch, dinner and snack(s) every day Sunday to Saturday, with portions scaled to hit my targets.
- **US-12** As Jadon, I can see batch cooking instructions with quantities for the Sunday batch (Sun–Wed) and Thursday batch (Thu–Sat).
- **US-13** As Jadon, every recipe has at most 1 hour active cooking time and the selection favors low cost.
- **US-14** As Jadon, each new week's recipes are different from the previous week's.
- **US-28** As Jadon, I can set a range for how many ingredients a dish needs (e.g. 3–5), and the shortlist only offers dishes within it. Pantry staples (salt, pepper, cooking oil, water) don't count.
- **US-29** As Jadon, I can start a week's plan over (e.g. I don't want Mexican after all): its shortlist, picks and any finalized plan are cleared and I choose cuisines again. The app asks me to confirm first and warns me if I've already logged meals that week.
- **US-30** As Jadon, the recipe search looks wider: more kinds of protein (not just chicken and beef for dinner), rotating from week to week, and more pages per meal.
- **US-31** As Jadon, I can set a maximum cost per meal (e.g. $4) on my profile, and the shortlist only offers dishes whose meal, at the portion I'll actually eat, costs at or under it. A dish the app can't price yet is still offered, marked "price unknown". If too few dishes fit, the cheapest others fill the shortlist, marked with how far over they are.
- **US-32** As Jadon, I can set a weekly grocery budget (e.g. $80) on my profile, and the finalized week on the Plan page and the shopping list show the estimated total against it, with a warning when it's over.

### Shopping list
- **US-15** As Jadon, after finalizing the plan I get one shopping list for the week, including staples.
- **US-16** As Jadon, each item shows the H-E-B package to buy (rounded up to a real package size), quantity and estimated price.
- **US-17** As Jadon, the list is grouped by store section and shows the total cost.
- **US-18** As Jadon, items only needed for the Thursday batch are marked.
- **US-19** As Jadon, I can check items off as I shop (online).

### Daily logging
- **US-20** As Jadon, I can see today's planned meals and snacks with portions and nutrition.
- **US-21** As Jadon, I tap to confirm each item as eaten; only confirmed items count toward totals.
- **US-22** As Jadon, I can change a confirmed item's portion or mark it skipped.
- **US-23** As Jadon, I see running totals for calories, protein, carbs and fat vs my targets.

### Eating out (manual)
- **US-24** As Jadon, I can replace a planned meal with a restaurant item by typing the restaurant, item name, amount eaten and its calories, protein, carbs and fat.
- **US-25** As Jadon, the restaurant item counts in that day's totals in place of the planned meal; the rest of the day is not rebalanced.

### Weight
- **US-26** As Jadon, I can log my weight once a week.
- **US-27** As Jadon, I can see a chart of my weigh-ins with a smoothed trend line.

## Technical requirements (MVP)

### Platform
- **TR-1** Single web app, responsive for phone and desktop widths.
- **TR-2** Installable as a Progressive Web App (manifest, icons, service worker).
- **TR-3** Server-side storage of all data so devices stay in sync.

### Auth
- **TR-4** Google OAuth sign-in.
- **TR-5** Allow-list of exactly one Google account; all API routes require an authenticated session.

### Recipes and nutrition
- **TR-6** Web recipe search that returns structured recipes (title, source URL, photo URL, ingredients with quantities, servings, steps, active time). Prefer pages with schema.org Recipe markup.
- **TR-7** Ingredient parsing into food name, quantity and unit.
- **TR-8** Nutrition calculated per ingredient from a food database (e.g. USDA FoodData Central) and summed per serving: calories, protein, carbs, fat, fiber, sugar, sodium.
- **TR-9** Recipes, parsed ingredients and nutrition are stored so they aren't re-fetched.

### Planning
- **TR-10** Target calculation: Mifflin-St Jeor BMR, activity multipliers (1.2 / 1.375 / 1.55 / 1.725 / 1.9), +300 kcal; macros as in US-5.
- **TR-11** Candidate ranking by cuisine match, active time ≤ 60 min, estimated cost, and protein density.
- **TR-12** Portion scaling: meals split ~80% of calories evenly across breakfast, lunch and dinner; snacks ~20% as 1–2 servings; solve servings to get close to calorie and protein targets.
- **TR-13** Exclude recipes used in the previous week.
- **TR-14** Batch quantities for 4 days (Sunday batch) and 3 days (Thursday batch).
- **TR-22** Ingredient count per recipe = its ingredient lines with a food, minus pantry staples (salt, black pepper, cooking oils and sprays, water) and optional lines. Recipes outside the profile's min–max range are left out of the candidates, like the 60-minute limit. No range set means no limit.
- **TR-23** Starting a week over deletes its week plan, candidates, plan items, shopping list and planned log entries (confirmed or skipped ones too). Restaurant log entries are kept. A week whose plan has logged meals (confirmed, skipped or restaurant) reports how many, so the confirm can warn.
- **TR-24** Search breadth: each slot has a list of proteins (breakfast: egg, greek yogurt, cottage cheese, turkey sausage, tofu; lunch: chicken, lentil, tuna, turkey, black bean, shrimp; dinner: chicken, beef, pork, salmon, shrimp, tofu, turkey; snack: greek yogurt, egg, cottage cheese, edamame). Each week uses 3 of them per slot, starting at a point set by the week's date, so consecutive weeks differ. Each query asks Brave for a second page (offset 1) only when its first gave fewer than 14 usable links. Up to 40 pages are read per slot in one request; no new page is started after 240 seconds, so the slot finishes within the 300-second limit. Video and social sites stay excluded, because they have no readable ingredient list.
- **TR-25** Cost cap: a candidate's meal cost is its cost per serving × the servings that meal needs (the slot's calorie share ÷ the recipe's kcal per serving, as in TR-12). Recipes whose meal cost is over the profile's `max_cost_cents_per_meal` are left out of the candidates. Recipes with no cost count as fitting and are shown as "price unknown". In-cap recipes keep the normal ranking; when fewer than 3 fit, the cheapest over-cap recipes fill up to 3 places after them, each showing how much it's over. No cap set means no limit.
- **TR-26** Weekly budget: the finalized week on the Plan page and the shopping list show the estimated weekly total (the shopping list total, using receipt-corrected prices where entered) beside `weekly_budget_cents`, with a warning when the total is higher and a count of items with no price. No budget set means nothing is shown.
- **TR-27** Price settings are whole dollars from 1 to 1,000, stored in cents; blank means none.

### Shopping and pricing
- **TR-15** Ingredient aggregation across recipes with unit conversion.
- **TR-16** Mapping of ingredients to H-E-B products with package size and price; rough estimates allowed when exact data isn't available. Prices cached and refreshed weekly.
- **TR-17** Section grouping and total cost.

### Logging and weight
- **TR-18** Per-day log entries: planned item or manual restaurant item, portion, status (planned / confirmed / skipped).
- **TR-19** Weight entries with date; smoothed trend (e.g. moving average).

### Units and cost
- **TR-20** US units in the UI (lb, ft/in, cups, oz); metric internally where formulas need it.
- **TR-21** Hosting, database and external services on free tiers. Any paid dependency is flagged in step 4 before it's chosen.
