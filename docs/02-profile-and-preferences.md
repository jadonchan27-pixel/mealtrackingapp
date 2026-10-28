# Facet 1: Profile, Calorie Target and Preferences

_Step 2 facet discussion. Builds on [01-project-plan.md](01-project-plan.md)._

## Profile

Stored for the single user:

| Field | Notes |
|---|---|
| Age | years |
| Sex | needed for the BMR formula |
| Height | feet and inches |
| Weight | pounds; updated from weight logs |
| Activity level | sedentary, light, moderate, active, very active |
| Goal | gain weight, primarily muscle (lean bulk) |

Units are US throughout: pounds, feet/inches, cups and ounces.

## Calorie target

1. **BMR** with Mifflin-St Jeor (weight in kg, height in cm, converted from US units):
   - Male: `10 × kg + 6.25 × cm − 5 × age + 5`
   - Female: `10 × kg + 6.25 × cm − 5 × age − 161`
2. **Maintenance (TDEE)** = BMR × activity multiplier:
   sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very active 1.9.
3. **Daily target** = TDEE + **300 kcal** lean-bulk surplus.

The target is recalculated whenever weight or profile fields change.

## Macro targets

- **Protein:** 1 g per lb of current body weight (4 kcal/g).
- **Fat:** about 25% of daily calories (9 kcal/g).
- **Carbs:** the remaining calories (4 kcal/g).

The meal plan aims for calories, protein, carbs and fat together.

## Preferences

- **Cuisine:** chosen at the start of each week (one or several). If skipped, the app picks. Any dish within a chosen cuisine is fine. No cuisines are excluded.
- **Allergies / excluded foods:** none.
- **Cooking time:** max **1 hour** active cooking per recipe batch (meals are batch cooked).
- **Cost:** as cheap as possible; no fixed budget.

## Open questions for later facets

- How weekly cuisine choice is prompted (facet 3, meal plan generation).
- How batch portions map to daily servings (facet 3).
