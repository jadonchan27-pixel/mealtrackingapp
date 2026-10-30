"use client";

import { useState } from "react";
import type {
  ItemResult,
  ItemSearch as SearchResponse,
} from "@/lib/restaurantSearch";

// US-37: finds an eat-out item's calories and macros so they needn't be
// typed. Items logged before come first, then USDA foods.
export function ItemSearch({ onPick }: { onPick: (item: ItemResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemResult[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function search() {
    const q = query.trim();
    if (q.length < 2) {
      setNote("Type at least 2 letters.");
      return;
    }
    setSearching(true);
    setNote(null);
    try {
      const res = await fetch(
        `/api/restaurant-items?q=${encodeURIComponent(q)}`,
      );
      const json = (await res
        .json()
        .catch(() => ({}))) as Partial<SearchResponse> & {
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Search didn't work.");
      setResults(json.items ?? []);
      setNote(json.usdaError ?? null);
    } catch (err) {
      setResults(null);
      setNote(err instanceof Error ? err.message : "Search didn't work.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="item-search">
      <label className="field">
        <span>Search for it</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="big mac, chicken burrito"
        />
      </label>
      <button type="button" onClick={search} disabled={searching}>
        {searching ? "Searching…" : "Search"}
      </button>
      {note && <p className="field-hint">{note}</p>}
      {results !== null &&
        (results.length === 0 ? (
          <p className="field-hint">
            Nothing found. Try fewer words, or enter the numbers below.
          </p>
        ) : (
          <ul className="item-results">
            {results.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(r);
                    setResults(null);
                  }}
                >
                  <strong>{r.itemName}</strong>
                  {r.source === "past" && (
                    <span className="muted"> · logged before</span>
                  )}
                  {r.restaurantName && (
                    <span className="muted"> · {r.restaurantName}</span>
                  )}
                  <span className="item-result-facts">
                    {r.portion}: {r.kcal} kcal · {r.proteinG} g protein ·{" "}
                    {r.carbsG} g carbs · {r.fatG} g fat
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
