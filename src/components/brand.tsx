import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-gold shadow-gold", className)}>
      <span className="display text-[1.45rem] font-semibold leading-none text-primary-foreground" aria-hidden>B</span>
    </div>
  );
}

export function Brand({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="leading-tight">
        <div className="whitespace-nowrap text-[14px] font-semibold tracking-tight">Blooms Members Club</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">Club Management & BI</div>}
      </div>
    </div>
  );
}
