// Smoothed weight trend (TR-19): a moving average over the last few weigh-ins.

export const TREND_WINDOW = 3;

export type WeighIn = { date: string; weightLb: number };
export type TrendPoint = WeighIn & { trendLb: number };

// Sorts by date (YYYY-MM-DD sorts as text) and gives each weigh-in the average
// of itself and up to the previous `window - 1` weigh-ins, to one decimal.
export function movingAverage(
  entries: readonly WeighIn[],
  window: number = TREND_WINDOW,
): TrendPoint[] {
  if (!Number.isInteger(window) || window < 1) {
    throw new Error("window must be a whole number of at least 1");
  }
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((entry, i) => {
    const recent = sorted.slice(Math.max(0, i - window + 1), i + 1);
    const mean = recent.reduce((sum, e) => sum + e.weightLb, 0) / recent.length;
    return { ...entry, trendLb: Math.round(mean * 10) / 10 };
  });
}
