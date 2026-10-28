import Link from "next/link";
import { RecipePhoto } from "@/components/RecipeFacts";
import type { PlanItemView, WeekView } from "@/lib/plans";
import { dailyTotals } from "@/lib/scaling";
import { SLOT_LABELS } from "@/lib/weeks";

export type DailyTargets = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

// A finalized week's totals for one day, from its items' servings per day.
export function planDailyTotals(items: readonly PlanItemView[]) {
  return dailyTotals(
    items.map((i) => ({
      slot: i.slot,
      recipeId: i.recipe.id,
      kcal: i.recipe.kcal ?? 0,
      proteinG: i.recipe.proteinG ?? 0,
      carbsG: i.recipe.carbsG ?? 0,
      fatG: i.recipe.fatG ?? 0,
      servingsPerDay: i.servingsPerDay,
    })),
  );
}

// "1.5 servings", "1 serving", "¾ serving"
export function servingsLabel(servings: number): string {
  const whole = Math.floor(servings);
  const part = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" }[servings - whole];
  const amount =
    part === undefined
      ? String(servings)
      : whole === 0
        ? part
        : `${whole}${part}`;
  return `${amount} ${servings > 1 ? "servings" : "serving"}`;
}

// How far a total is from its target: "+3%", "−12%", "on target".
export function offTarget(total: number, target: number): string {
  if (target <= 0) return "";
  const pct = Math.round(((total - target) / target) * 100);
  if (pct === 0) return "on target";
  return pct > 0 ? `+${pct}%` : `−${-pct}%`;
}

// US-11: the finalized week, the same meals every day Sunday to Saturday,
// with one day's totals against the targets.
export function FinalWeek({
  week,
  targets,
  weekLabel,
}: {
  week: WeekView;
  targets: DailyTargets | null;
  weekLabel: string;
}) {
  const totals = planDailyTotals(week.items);
  const rows: [string, keyof DailyTargets, string][] = [
    ["Calories", "kcal", "kcal"],
    ["Protein", "proteinG", "g"],
    ["Carbs", "carbsG", "g"],
    ["Fat", "fatG", "g"],
  ];

  return (
    <div className="plan-layout">
      <section className="card plan-summary">
        <h2>Week of {weekLabel}</h2>
        <p className="muted">
          Finalized. The same meals every day, Sunday to Saturday
          {week.cuisines.length > 0 && ` · ${week.cuisines.join(", ")}`}.
        </p>
        <p>
          <Link href="/plan/batches">
            Batch cooking: what to make Sunday and Thursday →
          </Link>
        </p>
      </section>

      <ul className="candidates final-items">
        {week.items.map((item) => (
          <li key={item.id} className="card candidate">
            <RecipePhoto
              url={item.recipe.photoUrl}
              title={item.recipe.title}
              className="candidate-photo"
            />
            <p className="slot-label">{SLOT_LABELS[item.slot]}</p>
            <h3>
              <Link href={`/recipes/${item.recipe.id}`}>
                {item.recipe.title}
              </Link>
            </h3>
            <p className="recipe-meta">
              <span>{servingsLabel(item.servingsPerDay)} a day</span>
              {item.recipe.kcal !== null && (
                <span>
                  {Math.round(item.recipe.kcal * item.servingsPerDay)} kcal
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>

      <section className="card" aria-labelledby="daily-totals">
        <h2 id="daily-totals">Each day</h2>
        <table className="weigh-ins">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">Planned</th>
              <th scope="col">Target</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, key, unit]) => (
              <tr key={key}>
                <td>{label}</td>
                <td>
                  {Math.round(totals[key])} {unit}
                </td>
                <td>{targets ? `${targets[key]} ${unit}` : "–"}</td>
                <td className="muted">
                  {targets ? offTarget(totals[key], targets[key]) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!targets && (
          <p className="muted">
            Save your <Link href="/profile">profile</Link> to see your targets.
          </p>
        )}
      </section>
    </div>
  );
}
