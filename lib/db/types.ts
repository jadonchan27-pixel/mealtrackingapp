// Database types matching supabase/migrations. Update this file whenever a
// migration changes a table or enum.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Sex = "male" | "female";
export type ActivityLevel =
  "sedentary" | "light" | "moderate" | "active" | "very_active";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type PlanStatus = "draft" | "final";
export type Batch = "sunday" | "thursday" | "both";
export type LogKind = "planned" | "restaurant";
export type LogStatus = "planned" | "confirmed" | "skipped";
export type StoreSection =
  | "produce"
  | "meat_seafood"
  | "dairy_eggs"
  | "bakery"
  | "pantry"
  | "spices_staples"
  | "frozen";

type Timestamps = { created_at: string; updated_at: string };

// Columns every table fills in by default on insert.
type Defaulted = "user_id" | "created_at" | "updated_at";

// Insert makes columns with defaults (and nullable columns) optional.
type TableDef<Row, Optional extends keyof Row> = {
  Row: Row;
  Insert: Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRow = Timestamps & {
  user_id: string;
  age: number;
  sex: Sex;
  height_in: number;
  weight_lb: number;
  activity_level: ActivityLevel;
  surplus_kcal: number;
};

export type FoodRow = Timestamps & {
  id: number;
  user_id: string;
  name: string;
  fdc_id: number | null;
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  fiber_100g: number | null;
  sugar_100g: number | null;
  sodium_mg_100g: number | null;
  grams_per_unit: Json;
  section: StoreSection;
};

export type HebProductRow = Timestamps & {
  id: number;
  user_id: string;
  food_id: number;
  name: string;
  package_grams: number;
  price_cents: number;
  is_estimate: boolean;
};

export type RecipeRow = Timestamps & {
  id: number;
  user_id: string;
  source_url: string;
  title: string;
  photo_url: string | null;
  cuisine: string | null;
  servings: number;
  active_minutes: number | null;
  steps: Json;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  cost_cents_per_serving: number | null;
};

export type RecipeIngredientRow = Timestamps & {
  id: number;
  user_id: string;
  recipe_id: number;
  raw_text: string;
  food_id: number | null;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
};

export type WeekPlanRow = Timestamps & {
  id: number;
  user_id: string;
  week_start: string;
  cuisines: string[];
  status: PlanStatus;
};

export type PlanCandidateRow = Timestamps & {
  id: number;
  user_id: string;
  week_plan_id: number;
  slot: MealSlot;
  recipe_id: number;
  rank: number;
  selected: boolean;
};

export type PlanItemRow = Timestamps & {
  id: number;
  user_id: string;
  week_plan_id: number;
  slot: MealSlot;
  recipe_id: number;
  servings_per_day: number;
};

export type ShoppingListItemRow = Timestamps & {
  id: number;
  user_id: string;
  week_plan_id: number;
  food_id: number | null;
  heb_product_id: number | null;
  name: string;
  section: StoreSection;
  needed_grams: number;
  packages: number;
  price_cents: number;
  batch: Batch;
  checked: boolean;
};

export type LogEntryRow = Timestamps & {
  id: number;
  user_id: string;
  date: string;
  slot: MealSlot;
  kind: LogKind;
  status: LogStatus;
  plan_item_id: number | null;
  portion: number;
  restaurant_name: string | null;
  item_name: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type WeightEntryRow = Timestamps & {
  id: number;
  user_id: string;
  date: string;
  weight_lb: number;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13" };
  public: {
    Tables: {
      profile: TableDef<ProfileRow, Defaulted | "surplus_kcal">;
      foods: TableDef<
        FoodRow,
        | Defaulted
        | "id"
        | "fdc_id"
        | "kcal_100g"
        | "protein_100g"
        | "carbs_100g"
        | "fat_100g"
        | "fiber_100g"
        | "sugar_100g"
        | "sodium_mg_100g"
        | "grams_per_unit"
        | "section"
      >;
      heb_products: TableDef<HebProductRow, Defaulted | "id" | "is_estimate">;
      recipes: TableDef<
        RecipeRow,
        | Defaulted
        | "id"
        | "photo_url"
        | "cuisine"
        | "active_minutes"
        | "steps"
        | "kcal"
        | "protein_g"
        | "carbs_g"
        | "fat_g"
        | "fiber_g"
        | "sugar_g"
        | "sodium_mg"
        | "cost_cents_per_serving"
      >;
      recipe_ingredients: TableDef<
        RecipeIngredientRow,
        Defaulted | "id" | "food_id" | "quantity" | "unit" | "grams"
      >;
      week_plans: TableDef<
        WeekPlanRow,
        Defaulted | "id" | "cuisines" | "status"
      >;
      plan_candidates: TableDef<
        PlanCandidateRow,
        Defaulted | "id" | "selected"
      >;
      plan_items: TableDef<PlanItemRow, Defaulted | "id">;
      shopping_list_items: TableDef<
        ShoppingListItemRow,
        Defaulted | "id" | "food_id" | "heb_product_id" | "checked"
      >;
      log_entries: TableDef<
        LogEntryRow,
        | Defaulted
        | "id"
        | "status"
        | "plan_item_id"
        | "portion"
        | "restaurant_name"
        | "item_name"
        | "kcal"
        | "protein_g"
        | "carbs_g"
        | "fat_g"
      >;
      weight_entries: TableDef<WeightEntryRow, Defaulted | "id">;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      sex: Sex;
      activity_level: ActivityLevel;
      meal_slot: MealSlot;
      plan_status: PlanStatus;
      batch: Batch;
      log_kind: LogKind;
      log_status: LogStatus;
      store_section: StoreSection;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
