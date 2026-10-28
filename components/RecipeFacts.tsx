import type { RecipeSummary } from "@/lib/plans";

// "35 min", "1 hr 5 min", or "Time not given".
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "Time not given";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// "$2.35 a serving", or null until H-E-B prices cover every ingredient.
export function formatCost(cents: number | null): string | null {
  if (cents === null) return null;
  return `$${(cents / 100).toFixed(2)} a serving`;
}

function grams(v: number | null): string {
  return v === null ? "–" : `${Math.round(v)} g`;
}

type Facts = Pick<
  RecipeSummary,
  | "activeMinutes"
  | "kcal"
  | "proteinG"
  | "carbsG"
  | "fatG"
  | "costCentsPerServing"
>;

// Active time, nutrition per serving and cost, as on a candidate card and the
// recipe page (US-9).
export function RecipeFacts({ recipe }: { recipe: Facts }) {
  const cost = formatCost(recipe.costCentsPerServing);
  return (
    <>
      <p className="recipe-meta">
        <span>⏱ {formatMinutes(recipe.activeMinutes)} active</span>
        {cost && <span>{cost}</span>}
      </p>
      <dl className="recipe-nutrition" aria-label="Nutrition per serving">
        <div>
          <dt>kcal</dt>
          <dd>{recipe.kcal === null ? "–" : Math.round(recipe.kcal)}</dd>
        </div>
        <div>
          <dt>Protein</dt>
          <dd>{grams(recipe.proteinG)}</dd>
        </div>
        <div>
          <dt>Carbs</dt>
          <dd>{grams(recipe.carbsG)}</dd>
        </div>
        <div>
          <dt>Fat</dt>
          <dd>{grams(recipe.fatG)}</dd>
        </div>
      </dl>
    </>
  );
}

// Recipe photos come from any recipe site, so they're plain images rather
// than next/image, which needs every host listed in advance.
export function RecipePhoto({
  url,
  title,
  className,
}: {
  url: string | null;
  title: string;
  className?: string;
}) {
  if (!url) {
    return (
      <div className={`${className ?? ""} recipe-photo-empty`} aria-hidden>
        🍲
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={url}
      alt={title}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
