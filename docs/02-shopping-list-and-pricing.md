# Facet 4: Shopping List and Austin Pricing

_Step 2 facet discussion. Builds on [02-meal-plan-generation.md](02-meal-plan-generation.md)._

## Store and prices

- One store: **H-E-B, Austin, Texas**.
- Prices come from H-E-B's real listed prices. Rough estimates are acceptable when an exact price isn't available.
- How prices are fetched (H-E-B has no public API) is decided in step 4, architecture.

## What goes on the list

- Every ingredient for the week's approved recipes (both batches), with quantities summed across recipes.
- Staples (salt, pepper, oil, spices) are **included**, not left out.
- Quantities are rounded up to **real H-E-B package sizes** (e.g. need 1 lb rice, buy the 2 lb bag).
- Items for the Thursday batch are marked so they can be stored properly.

## Leftovers and ingredient history

- The app tracks the leftover amount of each purchased package (bought minus used by the week's recipes).
- It also keeps a history of ingredients Jadon has bought and used before.
- When ranking recipes for the shortlist, the app prefers recipes that:
  1. use up leftover ingredients already on hand, and
  2. use ingredients Jadon has used before,
  so fewer new items are bought and the list stays short and cheap.
- Leftovers already on hand are subtracted from the next week's list.

## List layout

- Grouped by store section: produce, meat and seafood, dairy and eggs, bakery, pantry and dry goods, spices and staples, frozen.
- Each item shows the package to buy, quantity and estimated price.
- Running total cost for the week.
