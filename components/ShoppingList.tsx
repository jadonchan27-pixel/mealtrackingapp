"use client";

import { useState } from "react";
import type { ShoppingItemView, ShoppingList } from "@/lib/shopping";

// 1234 → "$12.34"
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// "12.5", "$12.50" → 1250; anything else → null.
export function parseDollars(text: string): number | null {
  const match = text.trim().match(/^\$?(\d{1,4})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export function listTotals(list: ShoppingList) {
  const items = list.sections.flatMap((s) => s.items);
  return {
    count: items.length,
    checked: items.filter((i) => i.checked).length,
    totalCents: items.reduce((t, i) => t + i.priceCents, 0),
    leftCents: items
      .filter((i) => !i.checked)
      .reduce((t, i) => t + i.priceCents, 0),
  };
}

const BATCH_NOTES = {
  sunday: "Sunday batch only",
  thursday: "Thursday batch only",
  both: null,
} as const;

async function patchItem(
  id: number,
  body: { checked?: boolean; actualPriceCents?: number },
): Promise<ShoppingItemView> {
  const res = await fetch(`/api/shopping-list/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.item;
}

// US-15 to US-19: the week's list by section. Checking an item saves right
// away, so the list is the same on the phone and the desktop.
export function ShoppingListView({ initial }: { initial: ShoppingList }) {
  const [list, setList] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const totals = listTotals(list);

  const replace = (item: ShoppingItemView) =>
    setList((l) => ({
      ...l,
      sections: l.sections.map((s) => ({
        ...s,
        items: s.items.map((i) => (i.id === item.id ? item : i)),
      })),
    }));

  async function toggle(item: ShoppingItemView) {
    setError(null);
    replace({ ...item, checked: !item.checked });
    try {
      replace(await patchItem(item.id, { checked: !item.checked }));
    } catch (err) {
      replace(item);
      setError(err instanceof Error ? err.message : "Couldn't save.");
    }
  }

  async function savePrice(item: ShoppingItemView, cents: number) {
    setError(null);
    const saved = await patchItem(item.id, { actualPriceCents: cents });
    replace(saved);
  }

  return (
    <div className="plan-layout">
      <section className="card shopping-summary" aria-live="polite">
        <p className="shopping-total">
          <strong>{formatPrice(totals.totalCents)}</strong> estimated at H-E-B
        </p>
        <p className="muted">
          {totals.checked} of {totals.count} items in the cart ·{" "}
          {formatPrice(totals.leftCents)} left
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </section>

      {list.sections.map((section) => (
        <section
          key={section.section}
          className="card"
          aria-labelledby={`section-${section.section}`}
        >
          <h2 id={`section-${section.section}`}>{section.label}</h2>
          <ul className="shopping-items">
            {section.items.map((item) => (
              <ShoppingRow
                key={item.id}
                item={item}
                onToggle={() => toggle(item)}
                onSavePrice={(cents) => savePrice(item, cents)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ShoppingRow({
  item,
  onToggle,
  onSavePrice,
}: {
  item: ShoppingItemView;
  onToggle: () => void;
  onSavePrice: (cents: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const note = BATCH_NOTES[item.batch];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseDollars(price);
    if (cents === null) {
      setError("Enter the price like 4.99.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSavePrice(cents);
      setEditing(false);
      setPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className={item.checked ? "shopping-item checked" : "shopping-item"}>
      <label className="shopping-check">
        <input type="checkbox" checked={item.checked} onChange={onToggle} />
        <span>
          <span className="shopping-name">
            {item.packages > 1 && `${item.packages} × `}
            {item.name}
          </span>
          <span className="muted shopping-detail">
            {item.neededGrams > 0 ? `needs ${item.neededGrams} g` : "staple"}
            {note && ` · ${note}`}
          </span>
        </span>
      </label>
      <span className="shopping-price">
        {formatPrice(item.priceCents)}
        {item.estimate && <span className="muted"> est.</span>}
      </span>
      {editing ? (
        <form className="shopping-paid" onSubmit={submit}>
          <label>
            Paid for {item.packages > 1 ? `all ${item.packages}` : "it"} $
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-label={`Price paid for ${item.name}`}
              autoFocus
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </form>
      ) : (
        <button
          type="button"
          className="link-button shopping-paid-button"
          onClick={() => setEditing(true)}
        >
          Price paid
        </button>
      )}
    </li>
  );
}
