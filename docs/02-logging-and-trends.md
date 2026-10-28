# Facet 6: Logging, Weight and Trends

_Step 2 facet discussion. Builds on [02-profile-and-preferences.md](02-profile-and-preferences.md) and [02-eating-out.md](02-eating-out.md)._

## Daily food logging

- Each planned meal and snack for the day is listed with its portion and nutrition.
- Jadon **taps to confirm** each one as eaten. Unconfirmed items don't count toward the day's totals.
- A confirmed item can be changed to a different portion, swapped for a restaurant item (facet 5), or marked skipped.
- The day view shows running totals vs target for calories, protein, carbs and fat.

## Weight

- Jadon weighs in **once a week**.
- **Default:** a reminder on Sunday morning, before shopping and cooking.
- Each new weight updates the profile, which recalculates the calorie target and protein goal (facet 1).

## Trends

- **Weight trend line:** weekly weigh-ins with a smoothed trend line.
- **Calories vs target:** daily confirmed calories against the target.
- **Protein vs target:** daily confirmed protein against the goal.
- **Weekly averages:** average calories, protein, carbs and fat per week.

## Auto-adjusting the calorie target

The app adjusts the target automatically and notifies Jadon of each change.

- **Expected rate (lean bulk):** gain about 0.25 to 0.5 lb per week.
- **Defaults:**
  - Checked after each weekly weigh-in, using the trend over the last 2 or more weeks.
  - Gaining slower than 0.25 lb/week: raise the target by 150 kcal/day.
  - Gaining faster than 0.75 lb/week: lower the target by 150 kcal/day.
  - Only weeks where most meals were confirmed are used, so missed logging doesn't trigger a change.
- The notification says what changed and why. The new target applies to the next weekly plan.
