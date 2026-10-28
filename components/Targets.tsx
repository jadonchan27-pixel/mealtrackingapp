import type { Targets as TargetValues } from "@/lib/targets";

export function Targets({ targets }: { targets: TargetValues }) {
  return (
    <section className="card" aria-labelledby="targets-heading">
      <h2 id="targets-heading">Daily targets</h2>
      <p className="target-kcal">
        <strong>{targets.kcal.toLocaleString("en-US")}</strong> kcal
      </p>
      <dl className="target-macros">
        <div>
          <dt>Protein</dt>
          <dd>{targets.proteinG} g</dd>
        </div>
        <div>
          <dt>Carbs</dt>
          <dd>{targets.carbsG} g</dd>
        </div>
        <div>
          <dt>Fat</dt>
          <dd>{targets.fatG} g</dd>
        </div>
      </dl>
      <p className="muted">
        Resting {targets.bmr.toLocaleString("en-US")} kcal · maintenance{" "}
        {targets.tdee.toLocaleString("en-US")} kcal · plus a 300 kcal lean-bulk
        surplus.
      </p>
    </section>
  );
}
