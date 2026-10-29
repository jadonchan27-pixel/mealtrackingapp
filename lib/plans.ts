// Draft week plans (US-7 to US-10): create a week, search a slot for its 3
// candidates, select one, and read it all back in the shape the plan page and
// the API share (camelCase, per serving).

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  MealSlot,
  PlanCandidateRow,
  PlanItemRow,
  PlanStatus,
  RecipeRow,
  WeekPlanRow,
} from "@/lib/db/types";
import type { FoodLookup } from "@/lib/foods";
import {
  findTopRecipes,
  previousWeekRecipeIds,
  previousWeekStart,
  type SkippedPage,
} from "@/lib/recipeSearch";
import type { BraveClient } from "@/lib/services/braveSearch";
import type { RecipePage } from "@/lib/services/recipePage";
import { ensureProducts } from "@/lib/products";
import { scalePortions } from "@/lib/scaling";
import { targetsForProfile } from "@/lib/targets";
import {
  MEAL_SLOTS,
  mealsPerDay,
  PLAN_SLOTS,
  pickCuisine,
  SHARED_SLOT,
  type NewWeekInput,
} from "@/lib/weeks";

type Supabase = SupabaseClient<Database>;

export class PlanError extends Error {
  name = "PlanError";
  constructor(
    message: string,
    readonly status: 404 | 409 | 500 = 500,
  ) {
    super(message);
  }
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new PlanError(result.error.message);
  return result.data;
}

// Rows of a select that lists rows; never null once the error is checked.
function rows<T>(result: {
  data: T[] | null;
  error: { message: string } | null;
}): T[] {
  return check(result) ?? [];
}

export type RecipeSummary = {
  id: number;
  title: string;
  sourceUrl: string;
  photoUrl: string | null;
  cuisine: string | null;
  servings: number;
  activeMinutes: number | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  costCentsPerServing: number | null;
  // Ingredient lines as the recipe gives them, portions included.
  ingredients: string[];
};

export type CandidateView = {
  id: number;
  slot: MealSlot;
  rank: number;
  selected: boolean;
  recipe: RecipeSummary;
};

export type PlanItemView = {
  id: number;
  slot: MealSlot;
  servingsPerDay: number;
  recipe: RecipeSummary;
};

export type WeekView = {
  id: number;
  weekStart: string;
  cuisines: string[];
  status: PlanStatus;
  candidates: Record<MealSlot, CandidateView[]>;
  // The finalized week's recipes and servings per day, in slot order; empty
  // while the week is a draft.
  items: PlanItemView[];
  // Meals already logged this week (confirmed, skipped or eaten out), which
  // starting over would affect (US-29).
  loggedMeals: number;
};

function num(v: number | null): number | null {
  return v === null ? null : Number(v);
}

function summary(recipe: RecipeRow, ingredients: string[]): RecipeSummary {
  return {
    id: recipe.id,
    title: recipe.title,
    sourceUrl: recipe.source_url,
    photoUrl: recipe.photo_url,
    cuisine: recipe.cuisine,
    servings: Number(recipe.servings),
    activeMinutes: recipe.active_minutes,
    kcal: num(recipe.kcal),
    proteinG: num(recipe.protein_g),
    carbsG: num(recipe.carbs_g),
    fatG: num(recipe.fat_g),
    costCentsPerServing: num(recipe.cost_cents_per_serving),
    ingredients,
  };
}

// Candidate rows with their recipes, grouped by slot, best rank first.
async function candidateViews(
  supabase: Supabase,
  candidates: PlanCandidateRow[],
): Promise<Record<MealSlot, CandidateView[]>> {
  const ids = [...new Set(candidates.map((r) => r.recipe_id))];
  const recipes: RecipeRow[] =
    ids.length === 0
      ? []
      : rows(await supabase.from("recipes").select("*").in("id", ids));
  const lines =
    ids.length === 0
      ? []
      : rows(
          await supabase
            .from("recipe_ingredients")
            .select("recipe_id, raw_text")
            .in("recipe_id", ids)
            .order("id", { ascending: true }),
        );

  const grouped = Object.fromEntries(
    MEAL_SLOTS.map((s) => [s, [] as CandidateView[]]),
  ) as Record<MealSlot, CandidateView[]>;
  for (const row of [...candidates].sort((a, b) => a.rank - b.rank)) {
    const recipe = recipes.find((r) => r.id === row.recipe_id);
    if (!recipe) continue;
    grouped[row.slot].push({
      id: row.id,
      slot: row.slot,
      rank: row.rank,
      selected: row.selected,
      recipe: summary(
        recipe,
        lines.filter((l) => l.recipe_id === recipe.id).map((l) => l.raw_text),
      ),
    });
  }
  return grouped;
}

async function weekView(supabase: Supabase, week: WeekPlanRow) {
  const candidateRows = rows(
    await supabase
      .from("plan_candidates")
      .select("*")
      .eq("week_plan_id", week.id),
  );
  const itemRows = rows(
    await supabase.from("plan_items").select("*").eq("week_plan_id", week.id),
  );
  return {
    id: week.id,
    weekStart: week.week_start,
    cuisines: week.cuisines,
    status: week.status,
    candidates: await candidateViews(supabase, candidateRows),
    items: await itemViews(supabase, itemRows),
    loggedMeals: await loggedMeals(
      supabase,
      week.week_start,
      itemRows.map((i) => i.id),
    ),
  } satisfies WeekView;
}

// Meals logged this week, each day's slot counted once: a planned meal
// confirmed or skipped, or a restaurant meal (which also skips the planned
// one, so it isn't counted twice).
async function loggedMeals(
  supabase: Supabase,
  weekStart: string,
  itemIds: number[],
): Promise<number> {
  const entries = rows(
    await supabase
      .from("log_entries")
      .select("date, slot, kind, status, plan_item_id")
      .in("date", weekDates(weekStart)),
  );
  const logged = entries.filter((e) =>
    e.kind === "restaurant"
      ? true
      : e.status !== "planned" &&
        e.plan_item_id !== null &&
        itemIds.includes(e.plan_item_id),
  );
  return new Set(logged.map((e) => `${e.date}|${e.slot}`)).size;
}

async function itemViews(
  supabase: Supabase,
  items: PlanItemRow[],
): Promise<PlanItemView[]> {
  // The same recipe views as candidates, so one query path serves both.
  const asCandidates = items.map((i) => ({
    ...i,
    rank: 1,
    selected: true,
  }));
  const grouped = await candidateViews(supabase, asCandidates);
  return MEAL_SLOTS.flatMap((slot) =>
    grouped[slot].map((c) => ({
      id: c.id,
      slot,
      servingsPerDay: Number(
        items.find((i) => i.id === c.id)!.servings_per_day,
      ),
      recipe: c.recipe,
    })),
  );
}

// The week starting on `weekStart`, or null when it hasn't been started.
export async function loadWeek(
  supabase: Supabase,
  weekStart: string,
): Promise<WeekView | null> {
  const week = check(
    await supabase
      .from("week_plans")
      .select("*")
      .eq("week_start", weekStart)
      .maybeSingle(),
  );
  return week ? weekView(supabase, week) : null;
}

async function weekById(supabase: Supabase, id: number): Promise<WeekPlanRow> {
  const week = check(
    await supabase.from("week_plans").select("*").eq("id", id).maybeSingle(),
  );
  if (!week) throw new PlanError("Week not found", 404);
  return week;
}

// The week with this id; throws PlanError 404 when there's none.
export async function loadWeekById(
  supabase: Supabase,
  id: number,
): Promise<WeekView> {
  return weekView(supabase, await weekById(supabase, id));
}

function assertDraft(week: WeekPlanRow) {
  if (week.status !== "draft") {
    throw new PlanError("This week's plan is already finalized", 409);
  }
}

// US-7: starts the week's draft, or changes the cuisines of one already
// started. With no cuisine chosen, the app picks one not used last week.
export async function startWeek(
  supabase: Supabase,
  { weekStart, cuisines }: NewWeekInput,
  random?: () => number,
): Promise<WeekView> {
  let chosen = cuisines;
  if (chosen.length === 0) {
    const lastWeek = check(
      await supabase
        .from("week_plans")
        .select("cuisines")
        .eq("week_start", previousWeekStart(weekStart))
        .maybeSingle(),
    );
    chosen = [pickCuisine(lastWeek?.cuisines ?? [], random)];
  }

  const existing = check(
    await supabase
      .from("week_plans")
      .select("*")
      .eq("week_start", weekStart)
      .maybeSingle(),
  );
  if (existing) {
    assertDraft(existing);
    check(
      await supabase
        .from("week_plans")
        .update({ cuisines: chosen })
        .eq("id", existing.id),
    );
    return weekView(supabase, { ...existing, cuisines: chosen });
  }

  check(
    await supabase
      .from("week_plans")
      .insert({ week_start: weekStart, cuisines: chosen }),
  );
  const created = await loadWeek(supabase, weekStart);
  if (!created) throw new PlanError("Couldn't start the week");
  return created;
}

export type SlotSearch = {
  candidates: CandidateView[];
  // Pages read for this slot and the ones that couldn't be used.
  pagesRead: number;
  skipped: SkippedPage[];
};

// US-8: searches the web for one slot and replaces its candidates with
// every recipe that fits, ranked, the best one selected. Recipes from last
// week are left out (TR-13), and so are the recipes picked for this week's
// other meals, so the same recipe can't end up in two meals.
export async function searchSlot({
  supabase,
  weekId,
  slot,
  brave,
  lookup,
  readPage,
  wait,
}: {
  supabase: Supabase;
  weekId: number;
  slot: MealSlot;
  brave: Pick<BraveClient, "search">;
  lookup: FoodLookup;
  readPage?: (url: string) => Promise<RecipePage | null>;
  wait?: (ms: number) => Promise<void>;
}): Promise<SlotSearch> {
  const week = await weekById(supabase, weekId);
  assertDraft(week);

  const excludedIds = await previousWeekRecipeIds(supabase, week.week_start);
  const others = rows(
    await supabase
      .from("plan_candidates")
      .select("slot, recipe_id, selected")
      .eq("week_plan_id", week.id),
  );
  // Another meal's pick can't be this one's too. Other candidates can be
  // shared, now every recipe that fits is kept (US-8); selectCandidate
  // refuses a recipe already picked elsewhere.
  for (const c of others) {
    if (c.slot !== slot && c.selected) excludedIds.add(c.recipe_id);
  }

  const profile = check(
    await supabase.from("profile").select("*").maybeSingle(),
  );
  const capCents = profile?.max_cost_cents_per_meal ?? null;
  const found = await findTopRecipes({
    costCap:
      profile && capCents !== null
        ? { cents: capCents, dailyKcal: targetsForProfile(profile).kcal }
        : undefined,
    ingredientRange: {
      min: profile?.min_ingredients ?? null,
      max: profile?.max_ingredients ?? null,
    },
    supabase,
    brave,
    lookup,
    slot,
    cuisines: week.cuisines,
    excludedIds,
    readPage,
    wait,
    weekStart: week.week_start,
    // US-8: every recipe that fits, best first.
    limit: Infinity,
  });

  check(
    await supabase
      .from("plan_candidates")
      .delete()
      .eq("week_plan_id", week.id)
      .eq("slot", slot),
  );
  if (found.top.length > 0) {
    check(
      await supabase.from("plan_candidates").insert(
        found.top.map(({ recipe }, i) => ({
          week_plan_id: week.id,
          slot,
          recipe_id: recipe.id,
          rank: i + 1,
          selected: i === 0,
        })),
      ),
    );
  }
  const candidateRows = rows(
    await supabase
      .from("plan_candidates")
      .select("*")
      .eq("week_plan_id", week.id)
      .eq("slot", slot),
  );
  return {
    candidates: (await candidateViews(supabase, candidateRows))[slot],
    pagesRead: found.recipes.length + found.skipped.length,
    skipped: found.skipped,
  };
}

// US-10: picks a candidate, unselecting the others in its slot. A recipe
// already picked for another meal can't be picked again (shortlists made
// before searches left out other slots' candidates may share one).
export async function selectCandidate(
  supabase: Supabase,
  candidateId: number,
): Promise<CandidateView[]> {
  const candidate = check(
    await supabase
      .from("plan_candidates")
      .select("*")
      .eq("id", candidateId)
      .maybeSingle(),
  );
  if (!candidate) throw new PlanError("Candidate not found", 404);
  assertDraft(await weekById(supabase, candidate.week_plan_id));
  const pickedElsewhere = rows(
    await supabase
      .from("plan_candidates")
      .select("slot")
      .eq("week_plan_id", candidate.week_plan_id)
      .eq("recipe_id", candidate.recipe_id)
      .eq("selected", true),
  ).find((c) => c.slot !== candidate.slot);
  if (pickedElsewhere) {
    throw new PlanError(
      `This recipe is already picked for ${pickedElsewhere.slot}`,
      409,
    );
  }

  check(
    await supabase
      .from("plan_candidates")
      .update({ selected: false })
      .eq("week_plan_id", candidate.week_plan_id)
      .eq("slot", candidate.slot),
  );
  check(
    await supabase
      .from("plan_candidates")
      .update({ selected: true })
      .eq("id", candidate.id),
  );
  const candidateRows = rows(
    await supabase
      .from("plan_candidates")
      .select("*")
      .eq("week_plan_id", candidate.week_plan_id)
      .eq("slot", candidate.slot),
  );
  return (await candidateViews(supabase, candidateRows))[candidate.slot];
}

export type RecipeDetail = Omit<RecipeSummary, "ingredients"> & {
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  ingredients: { text: string; grams: number | null }[];
  steps: string[];
};

// US-9: a recipe with its ingredients and steps, or null when there's none.
export async function loadRecipe(
  supabase: Supabase,
  id: number,
): Promise<RecipeDetail | null> {
  const recipe = check(
    await supabase.from("recipes").select("*").eq("id", id).maybeSingle(),
  );
  if (!recipe) return null;
  const lines = rows(
    await supabase
      .from("recipe_ingredients")
      .select("raw_text, grams")
      .eq("recipe_id", id)
      .order("id", { ascending: true }),
  );
  return {
    ...summary(recipe, []),
    fiberG: num(recipe.fiber_g),
    sugarG: num(recipe.sugar_g),
    sodiumMg: num(recipe.sodium_mg),
    ingredients: lines.map((l) => ({ text: l.raw_text, grams: num(l.grams) })),
    steps: Array.isArray(recipe.steps)
      ? recipe.steps.filter((s): s is string => typeof s === "string")
      : [],
  };
}

// The 7 dates of the week starting on `weekStart`, Sunday to Saturday.
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// US-11, TR-12, TR-18, US-33: turns the week's picks into the plan. Each
// slot's recipe gets its servings per day, and every day Sunday to Saturday
// gets a planned log entry per meal: breakfast, and the shared dish as lunch
// and dinner with half its servings each. The week is then final.
export async function finalizeWeek(
  supabase: Supabase,
  weekId: number,
  targets: { kcal: number; proteinG: number },
): Promise<WeekView> {
  const week = await weekById(supabase, weekId);
  assertDraft(week);

  const picks = rows(
    await supabase
      .from("plan_candidates")
      .select("*")
      .eq("week_plan_id", week.id)
      .eq("selected", true),
  );
  const unpicked = PLAN_SLOTS.filter((s) => !picks.some((p) => p.slot === s));
  if (unpicked.length > 0) {
    throw new PlanError(`Pick a recipe for ${unpicked.join(", ")} first`, 409);
  }
  const recipes = rows(
    await supabase
      .from("recipes")
      .select("*")
      .in(
        "id",
        picks.map((p) => p.recipe_id),
      ),
  );
  const scaled = scalePortions(
    PLAN_SLOTS.map((slot) => {
      const pick = picks.find((p) => p.slot === slot)!;
      const recipe = recipes.find((r) => r.id === pick.recipe_id);
      if (!recipe) throw new PlanError(`The ${slot} recipe is missing`, 409);
      return {
        slot,
        recipeId: recipe.id,
        kcal: Number(recipe.kcal ?? 0),
        proteinG: Number(recipe.protein_g ?? 0),
        carbsG: Number(recipe.carbs_g ?? 0),
        fatG: Number(recipe.fat_g ?? 0),
        meals: mealsPerDay(slot, true),
      };
    }),
    targets,
  );
  // TR-16: every food in the plan has an H-E-B product for the shopping list.
  const lines = rows(
    await supabase
      .from("recipe_ingredients")
      .select("food_id")
      .in(
        "recipe_id",
        recipes.map((r) => r.id),
      ),
  );
  await ensureProducts(
    supabase,
    lines.map((l) => l.food_id).filter((id): id is number => id !== null),
  );

  check(
    await supabase.from("plan_items").insert(
      scaled.map((i) => ({
        week_plan_id: week.id,
        slot: i.slot,
        recipe_id: i.recipeId,
        servings_per_day: i.servingsPerDay,
      })),
    ),
  );
  const items = rows(
    await supabase.from("plan_items").select("*").eq("week_plan_id", week.id),
  );
  try {
    // A slot already eaten out (before a Start over) keeps its planned meal
    // skipped, so the two don't both count.
    const eatenOut = new Set(
      rows(
        await supabase
          .from("log_entries")
          .select("date, slot")
          .eq("kind", "restaurant")
          .in("date", weekDates(week.week_start)),
      ).map((e) => `${e.date}|${e.slot}`),
    );
    const entries = weekDates(week.week_start).flatMap((date) =>
      items.flatMap((item) => {
        const slots: MealSlot[] =
          item.slot === SHARED_SLOT ? [SHARED_SLOT, "dinner"] : [item.slot];
        return slots.map((slot) => ({
          date,
          slot,
          kind: "planned" as const,
          plan_item_id: item.id,
          portion: Number(item.servings_per_day) / slots.length,
          ...(eatenOut.has(`${date}|${slot}`)
            ? { status: "skipped" as const }
            : {}),
        }));
      }),
    );
    check(await supabase.from("log_entries").insert(entries));
    check(
      await supabase
        .from("week_plans")
        .update({ status: "final" })
        .eq("id", week.id),
    );
  } catch (err) {
    // Leave the week as a draft with no half-written plan.
    const ids = items.map((i) => i.id);
    await supabase.from("log_entries").delete().in("plan_item_id", ids);
    await supabase.from("plan_items").delete().eq("week_plan_id", week.id);
    throw err;
  }
  return weekView(supabase, { ...week, status: "final" });
}

// US-29, TR-23: starts the week over. Deletes its planned log entries (even
// confirmed or skipped ones), shopping list, plan items, candidates and the
// week itself, so the plan page goes back to choosing cuisines. Restaurant
// log entries are kept. Running it again after a failure finishes the job.
export async function resetWeek(
  supabase: Supabase,
  weekId: number,
): Promise<void> {
  const week = await weekById(supabase, weekId);
  const itemIds = rows(
    await supabase.from("plan_items").select("id").eq("week_plan_id", week.id),
  ).map((i) => i.id);
  if (itemIds.length > 0) {
    check(
      await supabase
        .from("log_entries")
        .delete()
        .eq("kind", "planned")
        .in("plan_item_id", itemIds),
    );
  }
  for (const table of [
    "shopping_list_items",
    "plan_items",
    "plan_candidates",
  ] as const) {
    check(await supabase.from(table).delete().eq("week_plan_id", week.id));
  }
  check(await supabase.from("week_plans").delete().eq("id", week.id));
}
