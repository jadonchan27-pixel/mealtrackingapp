# Step 4: Architecture

_Builds on [03-requirements.md](03-requirements.md). Covers the MVP only._

## Decisions

| Area | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language for UI, API and logic |
| App | **Next.js** (App Router), installable PWA | One web app for phone and desktop (TR-1, TR-2) |
| Hosting | **Vercel** free (Hobby) tier | Free, built for Next.js |
| Database | **Supabase** Postgres, free tier | Free hosted Postgres with row-level security |
| Auth | **Supabase Auth with Google** sign-in, one allowed email | TR-4, TR-5 |
| Recipe search | **Brave Search API** free tier | Finds recipe pages on the open web |
| Recipe parsing | **schema.org Recipe JSON-LD** on recipe pages, rule-based | Strictly free, no AI |
| Ingredient parsing | Rule-based parser (quantity, unit, food) | Strictly free, no AI |
| Nutrition | **USDA FoodData Central** API (free key) | TR-8 |
| H-E-B prices | **Estimated price table**, corrected from receipts | No public H-E-B API; no scraping |
| Charts | Recharts | Weight trend chart |
| Tests | Vitest for logic, Playwright for key flows | |

**Free tier notes.** Exact limits for Brave, USDA, Vercel and Supabase are checked when each service is set up. Supabase pauses a free project after a week with no activity; weekly use keeps it awake. Vercel functions have a time limit, so recipe search runs one meal slot per request.

## System overview

```
Phone / desktop browser (PWA)
        │
   Next.js on Vercel
   ├── pages (UI)
   ├── /api route handlers ── Supabase Postgres
   └── lib/ (pure logic: targets, parsing, nutrition, planning, shopping)
        │
   External: Brave Search, recipe web pages, USDA FoodData Central
```

## Key flows

### Targets (TR-10)
`lib/targets.ts`: convert lb and ft/in to kg and cm, compute Mifflin-St Jeor BMR, multiply by activity factor, add the surplus (300). Protein = 1 g × lb; fat = 25% of kcal ÷ 9; carbs = remainder ÷ 4. Computed on request, not stored.

### Recipe pipeline (TR-6 to TR-9, TR-11)
For each slot (breakfast, lunch, dinner, snack):
1. Build a query, e.g. `"<cuisine> high protein <slot> recipe"`.
2. Brave Search returns up to ~20 URLs; skip URLs already in `recipes`.
3. Fetch each page and read its JSON-LD `Recipe`. Skip pages without one.
4. Read active time from `prepTime` + `cookTime` (or `totalTime`). Drop recipes over 60 min.
5. Parse each `recipeIngredient` line into quantity, unit and food text.
6. Match food text to a `foods` row; if none, search USDA and cache the result with per-100 g nutrition.
7. Convert to grams, sum nutrition, divide by servings.
8. Estimate cost per serving from `heb_products`.
9. Store the recipe and ingredients. Unparseable lines are kept with `food_id = null` and shown to Jadon.

Ranking score per candidate: cuisine match, protein per 100 kcal (higher is better), cost per serving (lower is better). Recipes used in the previous week are excluded (TR-13), and so are recipes whose ingredient count (pantry staples left out) is outside the profile's range (TR-22). Recipes whose meal cost (cost per serving × servings the slot needs) is over the profile's cap are excluded too, unless fewer than 3 fit, when the cheapest over-cap ones fill the gaps after them (TR-25). Each week searches 3 proteins per slot from a rotating list, a second Brave page only when the first is thin, and reads up to 40 pages per slot, starting none after 240 s (TR-24). The top 3 per slot become candidates, the best one pre-selected.

### Portion scaling (TR-12)
Meals get ~80% of daily kcal (≈26.7% each), snacks ~20% as 1 or 2 servings. Each slot's servings per day = slot kcal ÷ recipe kcal per serving, rounded to the nearest 0.25. Then protein is checked; if it's short, the highest-protein recipe gets up to +0.5 serving within a 5% kcal tolerance.

### Finalize and shopping list (TR-14 to TR-17)
On finalize:
1. Write `plan_items` (slot, recipe, servings per day).
2. Batch quantity = servings per day × 4 (Sunday batch) and × 3 (Thursday batch).
3. Sum grams per food across all recipes and both batches. Note which batch(es) need each food.
4. Map each food to an `heb_products` row; packages = ceil(needed ÷ package size). Foods with no product get an estimated row flagged `is_estimate`.
5. Write `shopping_list_items` with section, packages, price and batch flag. The total is the sum of item prices.

Price correction: when Jadon enters the actual price paid on an item, the `heb_products` row is updated (`is_estimate = false`), so later weeks use real prices.

### Daily log (TR-18)
Finalizing the plan creates `log_entries` for every day and slot with `status = planned`. Confirming sets `status = confirmed`. Daily totals sum confirmed entries × portion. A restaurant entry replaces the planned entry for that slot: the planned entry becomes `skipped`, and a new entry with `kind = restaurant` is added.

### Weight (TR-19)
One entry per week. The trend line is a 3-entry moving average. Each new weight updates `profile.weight_lb`, so targets recalculate.

## Database schema

All tables have `user_id uuid` referencing `auth.users`, with row-level security `user_id = auth.uid()`. Timestamps (`created_at`, `updated_at`) are omitted below.

```sql
-- enums
create type sex as enum ('male','female');
create type activity_level as enum ('sedentary','light','moderate','active','very_active');
create type meal_slot as enum ('breakfast','lunch','dinner','snack');
create type plan_status as enum ('draft','final');
create type batch as enum ('sunday','thursday','both');
create type log_kind as enum ('planned','restaurant');
create type log_status as enum ('planned','confirmed','skipped');
create type store_section as enum ('produce','meat_seafood','dairy_eggs','bakery','pantry','spices_staples','frozen');

create table profile (
  user_id uuid primary key,
  age int not null,
  sex sex not null,
  height_in numeric not null,
  weight_lb numeric not null,
  activity_level activity_level not null,
  surplus_kcal int not null default 300,
  min_ingredients int,                            -- US-28; null = no limit
  max_ingredients int,
  max_cost_cents_per_meal int,                    -- US-31; null = no limit
  weekly_budget_cents int                         -- US-32; null = none
);

create table foods (
  id bigserial primary key,
  user_id uuid not null,
  name text not null,
  fdc_id int,
  kcal_100g numeric, protein_100g numeric, carbs_100g numeric, fat_100g numeric,
  fiber_100g numeric, sugar_100g numeric, sodium_mg_100g numeric,
  grams_per_unit jsonb not null default '{}',   -- e.g. {"cup": 185, "each": 50}
  section store_section not null default 'pantry',
  unique (user_id, name)
);

create table heb_products (
  id bigserial primary key,
  user_id uuid not null,
  food_id bigint not null references foods(id),
  name text not null,
  package_grams numeric not null,
  price_cents int not null,
  is_estimate boolean not null default true
);

create table recipes (
  id bigserial primary key,
  user_id uuid not null,
  source_url text not null,
  title text not null,
  photo_url text,
  cuisine text,
  servings numeric not null,
  active_minutes int,
  steps jsonb not null default '[]',
  kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  fiber_g numeric, sugar_g numeric, sodium_mg numeric,   -- per serving
  cost_cents_per_serving int,
  unique (user_id, source_url)
);

create table recipe_ingredients (
  id bigserial primary key,
  user_id uuid not null,
  recipe_id bigint not null references recipes(id) on delete cascade,
  raw_text text not null,
  food_id bigint references foods(id),          -- null if unparsed
  quantity numeric,
  unit text,
  grams numeric
);

create table week_plans (
  id bigserial primary key,
  user_id uuid not null,
  week_start date not null,                       -- always a Sunday
  cuisines text[] not null default '{}',          -- empty = app chooses
  status plan_status not null default 'draft',
  unique (user_id, week_start)
);

create table plan_candidates (
  id bigserial primary key,
  user_id uuid not null,
  week_plan_id bigint not null references week_plans(id) on delete cascade,
  slot meal_slot not null,
  recipe_id bigint not null references recipes(id),
  rank int not null,
  selected boolean not null default false
);

create table plan_items (
  id bigserial primary key,
  user_id uuid not null,
  week_plan_id bigint not null references week_plans(id) on delete cascade,
  slot meal_slot not null,
  recipe_id bigint not null references recipes(id),
  servings_per_day numeric not null,
  unique (week_plan_id, slot, recipe_id)
);

create table shopping_list_items (
  id bigserial primary key,
  user_id uuid not null,
  week_plan_id bigint not null references week_plans(id) on delete cascade,
  food_id bigint references foods(id),
  heb_product_id bigint references heb_products(id),
  name text not null,
  section store_section not null,
  needed_grams numeric not null,
  packages int not null,
  price_cents int not null,
  batch batch not null,
  checked boolean not null default false
);

create table log_entries (
  id bigserial primary key,
  user_id uuid not null,
  date date not null,
  slot meal_slot not null,
  kind log_kind not null,
  status log_status not null default 'planned',
  plan_item_id bigint references plan_items(id) on delete set null,
  portion numeric not null default 1,             -- servings for planned, fraction for restaurant
  restaurant_name text, item_name text,
  kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric  -- restaurant only
);

create table weight_entries (
  id bigserial primary key,
  user_id uuid not null,
  date date not null,
  weight_lb numeric not null,
  unique (user_id, date)
);
```

The `heb_products` table is filled from an estimated price catalog for ~150 common ingredients (`lib/hebCatalog.ts`). Each row belongs to a food, so a food gets its row, and its store section, the first time it's priced; foods the catalog doesn't know get an estimate from their section's default price per gram.

## API

Next.js route handlers under `/api`. All require the signed-in allowed user (TR-5) and return JSON. Dates are `YYYY-MM-DD`.

| Method | Path | Purpose | Stories |
|---|---|---|---|
| GET | `/api/profile` | Get profile | US-4 |
| PUT | `/api/profile` | Create or update profile | US-4, US-6 |
| GET | `/api/targets` | Calorie and macro targets | US-5 |
| POST | `/api/weeks` | Create draft plan `{ weekStart, cuisines }` | US-7 |
| GET | `/api/weeks/:weekStart` | Plan with candidates or items | US-10, US-11 |
| POST | `/api/weeks/:id/candidates` | Run search for one slot `{ slot }` | US-8, US-9 |
| PATCH | `/api/candidates/:id` | Select a candidate | US-10 |
| POST | `/api/weeks/:id/finalize` | Build plan items, log entries and shopping list | US-10 to US-15 |
| GET | `/api/weeks/:id/batches` | Batch cooking quantities | US-12 |
| POST | `/api/weeks/:id/reset` | Start the week over: delete its plan so cuisines can be chosen again | US-29 |
| GET | `/api/weeks/:id/shopping-list` | Grouped list and total | US-15 to US-18 |
| PATCH | `/api/shopping-list/:id` | `{ checked }` or `{ actualPriceCents }` | US-19 |
| GET | `/api/recipes/:id` | Recipe detail | US-9 |
| GET | `/api/log?date=` | Day's entries and totals | US-20, US-23 |
| PATCH | `/api/log/:id` | `{ status, portion }` | US-21, US-22 |
| POST | `/api/log/restaurant` | Replace a slot with a restaurant item | US-24, US-25 |
| DELETE | `/api/log/:id` | Remove a restaurant item; the planned meal comes back | US-24 |
| GET | `/api/weights` | Weight entries and trend | US-27 |
| POST | `/api/weights` | Log a weight | US-26 |

## Project structure

```
app/                 pages and /api route handlers
components/          UI components
lib/                 pure logic (targets, ingredient parser, nutrition, ranking, scaling, shopping)
lib/services/        Brave, USDA, recipe page fetcher
lib/db/              Supabase client and queries
supabase/migrations/ SQL schema
public/              PWA manifest and icons
tests/               Vitest and Playwright tests
```

## Configuration (environment variables)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_EMAIL`, `BRAVE_API_KEY`, `USDA_API_KEY`. Values are never committed.
