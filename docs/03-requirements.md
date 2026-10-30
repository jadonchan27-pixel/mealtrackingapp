# Step 3: Minimum Requirements

_Builds on [01-project-plan.md](01-project-plan.md) and the step 2 facet docs (`02-*.md`). Tech stack, schema and API design are decided in step 4._

## MVP scope

**In version 1**
1. Google login; installable web app for phone and desktop
2. Profile with calorie, protein, carb and fat targets
3. Weekly cuisine choice, recipe web search, nutrition calculated from ingredients
4. Saturday shortlist to approve or swap, then the weekly plan (breakfast plus one lunch-and-dinner dish, two batches)
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
- **US-8** As Jadon, the app searches the web and shows a shortlist of candidate recipes for breakfast and for the lunch-and-dinner dish (US-33): every recipe that fits, best first, with the top 3 shown up front, the rest behind "Show all", and the best match pre-selected.
- **US-9** As Jadon, each candidate shows its photo, ingredients with portions, active cooking time and nutrition per serving.
- **US-10** As Jadon, I can approve each pick or swap it for another candidate, then finalize the week's plan.
- **US-11** As Jadon, the finalized plan gives me the same breakfast and the same lunch-and-dinner dish every day Sunday to Saturday, with portions scaled to hit my targets.
- **US-12** As Jadon, I can see batch cooking instructions with quantities for the Sunday batch (Sun–Wed) and Thursday batch (Thu–Sat).
- **US-13** As Jadon, every recipe has at most 1 hour active cooking time and the selection favors low cost.
- **US-14** As Jadon, each new week's recipes are different from the previous week's.
- **US-28** As Jadon, I can set a range for how many ingredients a dish needs (e.g. 3–5), and the shortlist only offers dishes within it. Pantry staples (salt, pepper, cooking oil, water) don't count.
- **US-29** As Jadon, I can start a week's plan over (e.g. I don't want Mexican after all): its shortlist, picks and any finalized plan are cleared and I choose cuisines again. The app asks me to confirm first and warns me if I've already logged meals that week.
- **US-30** As Jadon, the recipe search looks wider: more kinds of protein (not just chicken and beef for dinner), rotating from week to week, and more pages per meal.
- **US-31** As Jadon, I can set a maximum cost per meal (e.g. $4) on my profile, and the shortlist only offers dishes whose meal, at the portion I'll actually eat, costs at or under it. A dish the app can't price yet is still offered, marked "price unknown". The rest still come after them, cheapest first, behind "Show all" (US-8), each marked with how far over it is.
- **US-33** As Jadon, to keep costs down, each week has only two dishes: breakfast, and one dish I cook once and eat for both lunch and dinner. There is no snack. Weeks planned before this change keep their meals.
- **US-34** As Jadon, when I set a max number of ingredients or a max cost per meal, the search looks for simple, cheap recipes on purpose, so more of what it finds fits my limits.
- **US-35** As Jadon, on the Plan page I can add my own recipe for a dish (its name, servings, calories and macros per serving, and optionally its ingredients, steps, link, cook time and cost per serving), and it becomes that dish's pick.
- **US-36** As Jadon, after finalizing a week I can still change a dish, to another recipe from its shortlist or to my own recipe. The change applies from today to the end of the week; days already past keep what was planned.
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
- **US-37** As Jadon, when I eat out I can search for the item (with the restaurant's name if I like) and pick a result, which fills in the item name and its calories, protein, carbs and fat. Items I've logged before come first. I can still change any number before saving.

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
- **TR-11** Candidate ranking by cuisine match, active time ≤ 60 min, estimated cost, and protein density. Cost weighs most (US-33): cost 0.4, cuisine 0.3, protein 0.3.
- **TR-12** Portion scaling: the day's calories split evenly across three meals: breakfast, lunch and dinner, where lunch and dinner are the same dish (US-33). Servings are solved per meal in quarters to get close to the calorie and protein targets; the shared dish's servings per day cover both meals, and its lunch and dinner log entries get half each.
- **TR-13** Exclude recipes used in the previous week.
- **TR-14** Batch quantities for 4 days (Sunday batch) and 3 days (Thursday batch).
- **TR-22** Ingredient count per recipe = its ingredient lines with a food, minus pantry staples (salt, black pepper, cooking oils and sprays, water) and optional lines. Recipes outside the profile's min–max range are left out of the candidates, like the 60-minute limit. No range set means no limit.
- **TR-23** Starting a week over deletes its week plan, candidates, plan items, shopping list and planned log entries (confirmed or skipped ones too). Restaurant log entries are kept. A week whose plan has logged meals (confirmed, skipped or restaurant) reports how many, so the confirm can warn.
- **TR-24** Search breadth: each slot has a list of proteins (breakfast: egg, greek yogurt, cottage cheese, turkey sausage, tofu; lunch-and-dinner dish: chicken, lentil, black bean, pork, ground turkey, beef, tofu, chickpea; the dish's searches say "dinner"). Each week uses 3 of them per slot, starting at a point set by the week's date, so consecutive weeks differ. Each query asks Brave for a second page (offset 1) only when its first gave fewer than 14 usable links. Up to 40 pages are read per slot in one request; no new page is started after 240 seconds, so the slot finishes within the 300-second limit. Video and social sites stay excluded, because they have no readable ingredient list.
- **TR-25** Cost cap: a candidate's meal cost is its cost per serving × the servings that meal needs (the slot's calorie share ÷ the recipe's kcal per serving, as in TR-12). Recipes with no cost count as fitting and are shown as "price unknown". In-cap recipes keep the normal ranking and come first; recipes whose meal cost is over the profile's `max_cost_cents_per_meal` follow, cheapest first, each showing how much it's over, so the top 3 are in-cap whenever 3 fit and "Show all" lists every option. No cap set means no limit.
- **TR-26** Weekly budget: the finalized week on the Plan page and the shopping list show the estimated weekly total (the shopping list total, using receipt-corrected prices where entered) beside `weekly_budget_cents`, with a warning when the total is higher and a count of items with no price. No budget set means nothing is shown.
- **TR-27** Price settings are whole dollars from 1 to 1,000, stored in cents; blank means none.
- **TR-28** Simple-recipe searches: when the profile sets `max_ingredients` or `max_cost_cents_per_meal`, each cuisine-and-protein search (TR-24) is preceded by one with a prefix: "easy", plus "5 ingredient" when the max is 6 or less or "few ingredient" when it is higher, and "cheap" first when a cost cap is set (e.g. "cheap easy few ingredient Mexican chicken dinner recipe"). The plain search still runs after it. Links are still taken from all searches in turn and the 40-page and 240-second limits are unchanged.
- **TR-29** Own recipes: saved as a recipe with the nutrition Jadon enters (calories 1 to 5,000 per serving; protein, carbs and fat 0 to 500 g; servings 1 to 50), `source_url` set to `custom:<uuid>`, with his link after a "|" when he gives one (so it never shares a row with a web recipe from the same page). Ingredient lines are parsed and matched to foods like a web recipe (TR-8) so they reach the shopping list, but they never change the entered nutrition. Cost per serving is what he enters, otherwise worked out from the ingredients (TR-16). The recipe is added to the slot's candidates first in rank and selected. It skips the search filters (time, ingredient range, cost cap, last week), and searching the slot again keeps it on the shortlist, unpicked. If USDA can't be reached, the ingredients are saved unmatched.
- **TR-31** Eat-out search: `GET /api/restaurant-items?q=` returns past restaurant entries whose restaurant or item name contains every word of the query (newest first, one per restaurant and item, nutrition for the whole item), then USDA FoodData Central foods for the query (SR Legacy, which lists chain items such as "McDONALD'S, BIG MAC"; Survey (FNDDS), whose generic dishes stand in for local places; and Branded). Each USDA result gives calories, protein, carbs and fat for one of its portions (its first portion with a weight, a branded food's serving in grams or ml, else 100 g), rounded to whole numbers, and names that portion. If USDA fails, past items are still returned with a note. Queries are 2 to 100 characters.
- **TR-30** Changing a finalized dish: the chosen candidate becomes the slot's pick and a new plan item; portions are scaled again for the whole day (TR-12) and the other dish's servings are updated too. For each day from today (Austin) to Saturday, planned entries still `planned` are replaced (the old dish's removed, the new dish's written; the other dish's portion updated); confirmed or skipped entries and restaurant meals are kept, and a slot eaten out gets the new dish as skipped. Earlier days keep the old dish, so the old plan item stays while entries use it. The Plan page, batches and shopping list use each slot's newest plan item; the shopping list is rebuilt for the whole week. A week whose Saturday has passed can't be changed.

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
