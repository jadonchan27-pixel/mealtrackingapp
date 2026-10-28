# Facet 2: Recipe Sourcing

_Step 2 facet discussion. Builds on [01-project-plan.md](01-project-plan.md) and [02-profile-and-preferences.md](02-profile-and-preferences.md)._

## Search

- The app searches the web broadly; there is no fixed list of recipe sites.
- Results are ranked by how well they match the week's request: chosen cuisine, max 1 hour active cooking per batch, low cost, and fit with calorie and macro targets (especially high protein).
- From each recipe the app keeps: title, source URL, photo, ingredients with quantities, servings, steps, and active cooking time.
- **Photo:** taken from the recipe's source page.

## Nutrition

- Nutrition is calculated from the ingredient list using a food database (e.g. USDA FoodData Central), not taken from the recipe site.
- Stored per serving: calories, protein, carbs, fat, plus fiber, sugar and sodium.

## Weekly shortlist

- The app proposes a shortlist of candidate recipes for breakfast, lunch and dinner.
- Jadon approves each pick or swaps it for another candidate before the weekly plan is final.
- **Default:** 3 candidates per meal slot, the top match pre-selected.

## Saved recipes and ratings

- Jadon rates each meal (thumbs up or thumbs down).
- Liked recipes are saved to a library and can be picked again in later weeks.
- Disliked recipes are never suggested again.
- **Default:** a liked recipe is not reused in the week immediately after it was eaten, so consecutive weeks stay completely different.
- Ratings feed future ranking: recipes similar to liked ones rank higher.
