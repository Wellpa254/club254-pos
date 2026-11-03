import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PRESET_LABEL, presetRange, todayNairobi, type Preset, type Range } from "@/lib/periods";

export function usePeriod(initial: Exclude<Preset, "custom"> = "today") {
  const [preset, setPreset] = useState<Preset>(initial);
  const [range, setRange] = useState<Range>(() => presetRange(initial));
  return {
    preset, range,
    choose(p: Preset) { setPreset(p); if (p !== "custom") setRange(presetRange(p)); },
    setCustom(r: Range) { setPreset("custom"); setRange(r); },
  };
}

export function PeriodPicker({ period }: { period: ReturnType<typeof usePeriod> }) {
  const today = todayNairobi();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={period.preset} onValueChange={(v) => period.choose(v as Preset)}>
        <SelectTrigger className="h-9 w-40"><CalendarRange className="size-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
        <SelectContent>{(Object.keys(PRESET_LABEL) as Preset[]).map((p) => <SelectItem key={p} value={p}>{PRESET_LABEL[p]}</SelectItem>)}</SelectContent>
      </Select>
      {period.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" max={today} className="h-9 w-[9.5rem]" value={period.range.start}
            onChange={(e) => e.target.value && period.setCustom({ start: e.target.value, end: e.target.value > period.range.end ? e.target.value : period.range.end })} />
          <span className="text-muted-foreground">–</span>
          <Input type="date" max={today} min={period.range.start} className="h-9 w-[9.5rem]" value={period.range.end}
            onChange={(e) => e.target.value && period.setCustom({ ...period.range, end: e.target.value })} />
        </div>
      )}
    </div>
  );
}
