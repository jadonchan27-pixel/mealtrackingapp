"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import type { TrendPoint } from "@/lib/trend";

// Weigh-ins are dots; the trend is a line, so the two read apart without color.
export function WeightChart({ entries }: { entries: TrendPoint[] }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Chart of weigh-ins with a 3-entry trend line"
    >
      <ul className="chart-legend" aria-hidden="true">
        <li>
          <span className="legend-dot" />
          Weigh-in
        </li>
        <li>
          <span className="legend-line" />
          Trend (last 3)
        </li>
      </ul>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={entries}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            stroke="var(--muted)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[
              (min: number) => Math.floor(min - 2),
              (max: number) => Math.ceil(max + 2),
            ]}
            allowDecimals={false}
            stroke="var(--muted)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            content={ChartTooltip}
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
          />
          <Line
            name="Weigh-in"
            dataKey="weightLb"
            stroke="none"
            dot={{
              r: 4,
              fill: "var(--series-weight)",
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: "var(--series-weight)",
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
            fill="var(--series-weight)"
            isAnimationActive={false}
          />
          <Line
            name="Trend"
            dataKey="trendLb"
            stroke="var(--series-trend)"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--series-trend)",
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: TooltipContentProps<ValueType, NameType>) {
  const point = payload?.[0]?.payload as TrendPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="chart-tooltip">
      <strong>{longDate(point.date)}</strong>
      <div>Weigh-in: {point.weightLb} lb</div>
      <div>Trend: {point.trendLb} lb</div>
    </div>
  );
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// "2026-11-08" → "Nov 8". Parsed by hand so the time zone can't shift the day.
export function shortDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

export function longDate(iso: string): string {
  return `${shortDate(iso)}, ${iso.slice(0, 4)}`;
}
