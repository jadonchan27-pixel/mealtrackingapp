# Meal Tracking App: Project Plan

_Step 1 of the build framework. High-level goals only; details are worked out per facet in step 2._

## Purpose

A personal app that counts calories and takes away the daily "what should I cook?" decision. Each week it plans every meal from recipes that fit my preferences, and gives me a shopping list that keeps the number of ingredients and the cost low while the meals stay tasty.

## User

- Single user (me). Simple single-user login so data syncs between devices.
- Used on a phone and in a desktop browser.

## Core goals

1. **Calorie target.** The app works out my daily calorie target from height, weight, activity level, and goal (lose, maintain, or gain).
2. **Preferences.** I set protein goals, preferred cuisines, max cooking time, and cost limits. Recipe suggestions follow these.
3. **Recipe discovery.** The app searches the internet for recipes that match my preferences.
4. **Weekly meal plan.**
   - Plans breakfast, lunch, and dinner for every day.
   - Breakfast, lunch, and dinner are all different from each other, but the same three meals can repeat every day of the week.
   - Every week gets a completely new set of meals.
5. **Shopping list.** One list per week that minimizes the number of distinct ingredients and the total cost, using real store prices from Austin, Texas (rough estimates are OK).
6. **Meal detail.** Each meal shows full nutrition (calories, protein, carbs, fat, and more), a photo, and the foods with portions.
7. **Eating out.** When I eat at a restaurant, I search for the restaurant and the menu item and swap it in for the planned meal. That day's log is updated; the rest of the day is not rebalanced.
8. **Progress tracking.** I log daily calories and protein (from the plan and any swaps), and log my weight and see trends over time.

## Out of scope (for now)

- Multiple users, sharing, or social features.
- Rebalancing the rest of the day after an off-plan meal.
- Barcode scanning or photo-based food recognition.

## Facets to discuss in step 2

Each one gets its own detailed discussion and summary file (`docs/02-<facet>.md`):

1. Profile, calorie target calculation, and preferences
2. Recipe sourcing from the internet (sources, how nutrition and photos are obtained)
3. Weekly meal plan generation (variety rules, fitting calorie and protein goals)
4. Shopping list optimization and Austin store pricing
5. Eating out: restaurant and menu item lookup and swapping
6. Daily logging, weight tracking, and trends
7. Login, devices (phone and desktop), and syncing

## Next steps (from the framework)

1. ✅ High-level goals and project plan (this doc)
2. Detailed facet discussions, one summary file each
3. Minimum requirements: user stories and technical requirements
4. Architecture: database schema, API design, tech stack
5. Step-by-step MVP build plan, one feature at a time
6. Implement one step at a time, committing to git
7. Validate each step before moving on
