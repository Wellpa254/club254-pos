import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("grid size-9 place-items-center rounded-lg bg-gold shadow-gold", className)}>
      <svg viewBox="0 0 24 24" className="size-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M17 7.5A6 6 0 1 0 17 16.5" />
        <circle cx="17.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

export function Brand({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">Club254</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">Club Management & BI</div>}
      </div>
    </div>
  );
}
