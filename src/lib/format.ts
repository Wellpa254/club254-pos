const kes = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });

export function ksh(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  const sign = n < 0 ? "-" : "";
  return `${sign}KSh ${kes.format(Math.abs(n))}`;
}

const TZ = "Africa/Nairobi";
export function fmtDateTime(d: string | Date) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(d));
}
export function fmtTime(d: string | Date) {
  return new Intl.DateTimeFormat("en-KE", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(d));
}
export function nairobiHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date()));
}
export function greeting() {
  const h = nairobiHour();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
/** Start of "today" in Nairobi, as ISO string. */
export function startOfTodayNairobi() {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  return new Date(`${ymd}T00:00:00+03:00`).toISOString();
}

/** Turn a database error into a calm, user-facing sentence. */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again.") {
  const msg = (err as { message?: string })?.message ?? "";
  if (msg.startsWith("STOCK_CHANGED")) {
    return `Stock level changed for ${msg.split(":")[1] ?? "an item"} while you were completing this sale. Please review the cart.`;
  }
  const known = [
    "Start a shift before selling", "You already have an open shift", "No open shift", "Cart is empty",
    "A reason is required when cash does not match", "Invalid discount", "Stock cannot go below zero",
    "A note is required", "Opening cash cannot be negative", "Invalid quantity or cost", "Product unavailable",
  ];
  const hit = known.find((k) => msg.includes(k));
  if (hit) return hit + ".";
  if (/JWT|session/i.test(msg)) return "Your session has expired. Please sign in again.";
  if (/Invalid login credentials/i.test(msg)) return "Incorrect email or password.";
  return fallback;
}
