"use client";

import { useEffect, useState } from "react";
import {
  budgetStatus,
  formatPrice,
  type BudgetStatus,
} from "@/lib/priceLimits";
import type { ShoppingList } from "@/lib/shopping";

// US-32: "$72.40 of your $80 budget", with a warning when over.
export function budgetMessage(status: BudgetStatus): {
  line: string;
  warning: string | null;
  note: string | null;
} {
  const over = status.totalCents - status.budgetCents;
  return {
    line: `Estimated ${formatPrice(status.totalCents)} of your ${formatPrice(status.budgetCents)} weekly budget.`,
    warning: status.over ? `Over budget by ${formatPrice(over)}.` : null,
    note:
      status.unpriced > 0
        ? `${status.unpriced} ${status.unpriced === 1 ? "item has" : "items have"} no store price yet, so the total is a rough guess.`
        : null,
  };
}

export function BudgetLine({ status }: { status: BudgetStatus }) {
  const { line, warning, note } = budgetMessage(status);
  return (
    <div className="budget">
      <p>{line}</p>
      {warning && (
        <p role="alert" className="field-error">
          {warning}
        </p>
      )}
      {note && <p className="muted">{note}</p>}
    </div>
  );
}

// The finalized week's budget line, from its shopping list.
export function WeekBudget({
  weekId,
  budgetCents,
}: {
  weekId: number;
  budgetCents: number;
}) {
  const [list, setList] = useState<ShoppingList | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/weeks/${weekId}/shopping-list`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (live && json?.sections) setList(json);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [weekId]);
  if (!list) return null;
  return <BudgetLine status={budgetStatus(list, budgetCents)} />;
}
