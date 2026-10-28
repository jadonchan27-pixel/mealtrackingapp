# Facet 5: Eating Out

_Step 2 facet discussion. Builds on [02-meal-plan-generation.md](02-meal-plan-generation.md)._

## Logging a restaurant meal

1. Jadon picks the planned meal (breakfast, lunch, dinner or snack) being replaced.
2. Searches for the restaurant, then the menu item.
3. Says how much was eaten: whole, half, or a custom amount.
4. The restaurant item replaces the planned meal in that day's log. The rest of the day is **not** rebalanced.

## Nutrition for restaurant items

- **Chains:** use published nutrition data.
- **Restaurants without published data** (most local Austin spots): the app estimates from similar dishes.
- Jadon can type in or correct the numbers manually at any time.
- Stored values: calories, protein, carbs, fat (same fields as recipes where available).

## The skipped planned portion

- The cooked portion that wasn't eaten is kept as a leftover.
- The app offers to move it to another meal slot or another day.
- Suggested slots stay within the batch's fridge window (Sunday batch: through Wednesday; Thursday batch: through Saturday), or Jadon can mark it as frozen.
- If not moved, it is simply recorded as skipped.

## Saved restaurant items

- Every restaurant item Jadon logs is saved with its nutrition (including any manual edits).
- Saved items appear first in search for quick re-logging.
