const NOTES = [50, 100, 200, 500, 1000, 2000, 5000];

/**
 * Quick "cash received" suggestions for a total (the exact amount is offered separately).
 * Rounds up to the next 100, 500 and 1,000, and adds the next banknotes above the total.
 * At most three, smallest first.
 */
export function quickCashAmounts(total: number): number[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  const up = (step: number) => Math.ceil(total / step) * step;
  const set = new Set<number>([up(100), up(500), up(1000)]);
  NOTES.filter((n) => n > total).slice(0, 2).forEach((n) => set.add(n));
  return [...set].filter((n) => n > total).sort((a, b) => a - b).slice(0, 3);
}

/** What the customer gets back, or how much they are still short. Both are whole shillings. */
export function cashChange(total: number, received: number): { change: number; short: number } {
  const diff = Math.round(received - total);
  return diff >= 0 ? { change: diff, short: 0 } : { change: 0, short: -diff };
}
