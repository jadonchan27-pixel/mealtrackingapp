# Facet 3: Weekly Meal Plan Generation

_Step 2 facet discussion. Builds on [02-profile-and-preferences.md](02-profile-and-preferences.md) and [02-recipe-sourcing.md](02-recipe-sourcing.md)._

## Weekly schedule

| Day | What happens |
|---|---|
| Saturday | Jadon picks the week's cuisine (or skips and the app picks), then reviews the shortlist and approves or swaps recipes. The plan and shopping list are finalized. |
| Sunday | Week starts. One shopping trip for the whole week. Cook batch 1. |
| Thursday | Cook batch 2. |

- **Batch 1 (Sunday)** covers Sunday to Wednesday (4 days).
- **Batch 2 (Thursday)** covers Thursday to Saturday (3 days).
- Both batches use the same recipes (see below). Everything is bought on Sunday; the app marks which items are for the Thursday batch so they can be stored properly.

## Meal structure

- Each day has breakfast, lunch, dinner and snacks.
- Breakfast, lunch, dinner and snacks are all different recipes from each other.
- The same set of recipes repeats every day of the week.
- Every week gets a completely new set (liked recipes may return after skipping at least one week, per facet 2).

## Snacks

- Snacks follow the same rules as meals: chosen cuisine, max 1 hour active cooking per batch, as cheap as possible, full nutrition, on the shortlist for approval.
- Snacks fill the gap between the three meals and the daily calorie target, so main meals stay a reasonable size.
- **Default:** snacks provide about 20% of daily calories, as 1 or 2 snack servings depending on the target.

## Hitting targets

- The three main meals split the remaining calories (about 80%) evenly.
- Portions are scaled per serving so each day hits the calorie target and macro targets (protein 1 g/lb, fat ~25%, carbs the rest) as closely as possible.
- Recipe batch quantities are scaled to the number of servings needed for each batch (4 days, then 3 days).
