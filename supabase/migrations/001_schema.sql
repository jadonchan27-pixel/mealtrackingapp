-- Schema for the MVP. See docs/04-architecture.md.
-- Every table has user_id (defaults to the signed-in user) and timestamps.

-- Enums
create type sex as enum ('male', 'female');
create type activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type plan_status as enum ('draft', 'final');
create type batch as enum ('sunday', 'thursday', 'both');
create type log_kind as enum ('planned', 'restaurant');
create type log_status as enum ('planned', 'confirmed', 'skipped');
create type store_section as enum (
  'produce', 'meat_seafood', 'dairy_eggs', 'bakery', 'pantry', 'spices_staples', 'frozen'
);

-- Keeps updated_at current on every update
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table profile (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  age int not null check (age > 0),
  sex sex not null,
  height_in numeric not null check (height_in > 0),
  weight_lb numeric not null check (weight_lb > 0),
  activity_level activity_level not null,
  surplus_kcal int not null default 300,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table foods (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  fdc_id int,
  kcal_100g numeric,
  protein_100g numeric,
  carbs_100g numeric,
  fat_100g numeric,
  fiber_100g numeric,
  sugar_100g numeric,
  sodium_mg_100g numeric,
  grams_per_unit jsonb not null default '{}', -- e.g. {"cup": 185, "each": 50}
  section store_section not null default 'pantry',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table heb_products (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id bigint not null references foods (id) on delete cascade,
  name text not null,
  package_grams numeric not null check (package_grams > 0),
  price_cents int not null check (price_cents >= 0),
  is_estimate boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recipes (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_url text not null,
  title text not null,
  photo_url text,
  cuisine text,
  servings numeric not null check (servings > 0),
  active_minutes int,
  steps jsonb not null default '[]',
  -- nutrition per serving
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  cost_cents_per_serving int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_url)
);

create table recipe_ingredients (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id bigint not null references recipes (id) on delete cascade,
  raw_text text not null,
  food_id bigint references foods (id) on delete set null, -- null if unparsed
  quantity numeric,
  unit text,
  grams numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table week_plans (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 7), -- always a Sunday
  cuisines text[] not null default '{}', -- empty = app chooses
  status plan_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table plan_candidates (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_plan_id bigint not null references week_plans (id) on delete cascade,
  slot meal_slot not null,
  recipe_id bigint not null references recipes (id) on delete cascade,
  rank int not null,
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plan_items (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_plan_id bigint not null references week_plans (id) on delete cascade,
  slot meal_slot not null,
  recipe_id bigint not null references recipes (id) on delete restrict,
  servings_per_day numeric not null check (servings_per_day > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_plan_id, slot, recipe_id)
);

create table shopping_list_items (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_plan_id bigint not null references week_plans (id) on delete cascade,
  food_id bigint references foods (id) on delete set null,
  heb_product_id bigint references heb_products (id) on delete set null,
  name text not null,
  section store_section not null,
  needed_grams numeric not null,
  packages int not null check (packages > 0),
  price_cents int not null check (price_cents >= 0),
  batch batch not null,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table log_entries (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  slot meal_slot not null,
  kind log_kind not null,
  status log_status not null default 'planned',
  plan_item_id bigint references plan_items (id) on delete set null,
  portion numeric not null default 1 check (portion >= 0), -- servings for planned, fraction for restaurant
  -- restaurant items only
  restaurant_name text,
  item_name text,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'restaurant' or (item_name is not null and kcal is not null))
);

create table weight_entries (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  weight_lb numeric not null check (weight_lb > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- Indexes for foreign keys and common lookups
create index on heb_products (food_id);
create index on recipe_ingredients (recipe_id);
create index on recipe_ingredients (food_id);
create index on plan_candidates (week_plan_id, slot);
create index on plan_items (week_plan_id);
create index on shopping_list_items (week_plan_id);
create index on log_entries (user_id, date);
create index on log_entries (plan_item_id);

-- updated_at triggers
create trigger set_updated_at before update on profile for each row execute function set_updated_at();
create trigger set_updated_at before update on foods for each row execute function set_updated_at();
create trigger set_updated_at before update on heb_products for each row execute function set_updated_at();
create trigger set_updated_at before update on recipes for each row execute function set_updated_at();
create trigger set_updated_at before update on recipe_ingredients for each row execute function set_updated_at();
create trigger set_updated_at before update on week_plans for each row execute function set_updated_at();
create trigger set_updated_at before update on plan_candidates for each row execute function set_updated_at();
create trigger set_updated_at before update on plan_items for each row execute function set_updated_at();
create trigger set_updated_at before update on shopping_list_items for each row execute function set_updated_at();
create trigger set_updated_at before update on log_entries for each row execute function set_updated_at();
create trigger set_updated_at before update on weight_entries for each row execute function set_updated_at();
