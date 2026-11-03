export type Preset = "today" | "yesterday" | "week" | "month" | "last_month" | "year" | "custom";
export type Range = { start: string; end: string }; // YYYY-MM-DD, inclusive, Nairobi local

export const PRESET_LABEL: Record<Preset, string> = {
  today: "Today", yesterday: "Yesterday", week: "This week", month: "This month",
  last_month: "Last month", year: "This year", custom: "Custom range",
};

const DAY = 86_400_000;
const toYmd = (d: Date) => d.toISOString().slice(0, 10);
const fromYmd = (s: string) => new Date(`${s}T00:00:00Z`);
export const addDays = (s: string, n: number) => toYmd(new Date(fromYmd(s).getTime() + n * DAY));
export const daysBetween = (a: string, b: string) => Math.round((fromYmd(b).getTime() - fromYmd(a).getTime()) / DAY);

export function todayNairobi(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(now);
}

/** Resolve a preset to a date range. Weeks start on Monday. */
export function presetRange(p: Exclude<Preset, "custom">, today = todayNairobi()): Range {
  const t = fromYmd(today);
  const y = t.getUTCFullYear(), m = t.getUTCMonth();
  switch (p) {
    case "today": return { start: today, end: today };
    case "yesterday": { const d = addDays(today, -1); return { start: d, end: d }; }
    case "week": { const dow = (t.getUTCDay() + 6) % 7; return { start: addDays(today, -dow), end: today }; }
    case "month": return { start: toYmd(new Date(Date.UTC(y, m, 1))), end: today };
    case "last_month": return { start: toYmd(new Date(Date.UTC(y, m - 1, 1))), end: toYmd(new Date(Date.UTC(y, m, 0))) };
    case "year": return { start: `${y}-01-01`, end: today };
  }
}

/** The equally long period immediately before `r`. */
export function previousRange(r: Range): Range {
  const len = daysBetween(r.start, r.end) + 1;
  return { start: addDays(r.start, -len), end: addDays(r.start, -1) };
}

export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function fmtRange(r: Range) {
  const f = (s: string) => new Intl.DateTimeFormat("en-KE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(fromYmd(s));
  return r.start === r.end ? f(r.start) : `${f(r.start)} – ${f(r.end)}`;
}

/** Group daily rows into day / ISO-week (Mon) / month buckets. */
export function groupRows<T extends { day: string } & Record<string, number | string>>(rows: T[], by: "day" | "week" | "month", keys: string[]) {
  const out = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    let k = r.day;
    if (by === "week") { const d = fromYmd(r.day); k = addDays(r.day, -((d.getUTCDay() + 6) % 7)); }
    if (by === "month") k = r.day.slice(0, 7) + "-01";
    const acc = out.get(k) ?? { day: k, ...Object.fromEntries(keys.map((x) => [x, 0])) };
    for (const x of keys) acc[x] = Number(acc[x]) + Number(r[x]);
    out.set(k, acc);
  }
  return [...out.values()];
}
