"use client";

import { useState, useSyncExternalStore } from "react";
import { WeightChart, longDate } from "@/components/WeightChart";
import type { TrendPoint } from "@/lib/trend";
import type { WeighInErrors } from "@/lib/weights";

// Today in the browser's time zone as YYYY-MM-DD.
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The server doesn't know the browser's time zone, so it renders no date and
// the browser fills in today after hydration.
const subscribe = () => () => {};
const useToday = () =>
  useSyncExternalStore(
    subscribe,
    () => localToday(),
    () => "",
  );

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; targetsKcal: number | null }
  | { kind: "error"; message: string };

export function WeightTracker({
  initialEntries,
}: {
  initialEntries: TrendPoint[];
}) {
  const today = useToday();
  const [entries, setEntries] = useState(initialEntries);
  const [date, setDate] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [errors, setErrors] = useState<WeighInErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date ?? today,
          weightLb: weight.trim() === "" ? null : Number(weight),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors(json.fields ?? {});
        setStatus({
          kind: "error",
          message: json.fields
            ? "Check the highlighted fields."
            : (json.error ?? "Couldn't save."),
        });
        return;
      }
      setErrors({});
      setEntries(json.entries);
      setWeight("");
      setStatus({ kind: "saved", targetsKcal: json.targets?.kcal ?? null });
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server." });
    }
  }

  const newestFirst = [...entries].reverse();

  return (
    <div className="weight-layout">
      <form className="card" onSubmit={onSubmit} noValidate>
        <h2>Log a weigh-in</h2>
        <div className="weight-inputs">
          <div className="field">
            <label htmlFor="weigh-date">Date</label>
            <input
              id="weigh-date"
              type="date"
              value={date ?? today}
              max={today || undefined}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.date}
            />
            {errors.date && <p className="field-error">{errors.date}</p>}
          </div>
          <div className="field">
            <label htmlFor="weigh-weight">Weight</label>
            <div className="inline-inputs">
              <input
                id="weigh-weight"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                aria-invalid={!!errors.weightLb}
              />
              <span>lb</span>
            </div>
            {errors.weightLb && (
              <p className="field-error">{errors.weightLb}</p>
            )}
          </div>
        </div>
        <div className="form-actions">
          <button
            type="submit"
            className="primary"
            disabled={status.kind === "saving"}
          >
            {status.kind === "saving" ? "Saving…" : "Save"}
          </button>
          <p role="status" className="form-status">
            {status.kind === "saved" &&
              (status.targetsKcal === null
                ? "Saved."
                : `Saved. Daily target is now ${status.targetsKcal.toLocaleString("en-US")} kcal.`)}
            {status.kind === "error" && status.message}
          </p>
        </div>
      </form>

      <section className="card" aria-labelledby="trend-heading">
        <h2 id="trend-heading">Trend</h2>
        {entries.length === 0 ? (
          <p className="muted">Log your first weigh-in to start the chart.</p>
        ) : (
          <>
            <WeightChart entries={entries} />
            <table className="weigh-ins">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Weigh-in</th>
                  <th scope="col">Trend</th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((e) => (
                  <tr key={e.date}>
                    <td>{longDate(e.date)}</td>
                    <td>{e.weightLb} lb</td>
                    <td>{e.trendLb} lb</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
