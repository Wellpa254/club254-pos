/** Shown while the signed-in area loads: the brand mark with a soft gold pulse. No text. */
export function Splash() {
  return (
    <div className="grid min-h-svh place-items-center bg-background" role="status" aria-label="Loading">
      <div className="relative grid place-items-center">
        <span className="splash-ring absolute size-32 rounded-full" aria-hidden />
        <div className="grid size-20 place-items-center rounded-[1.4rem] bg-gold shadow-gold">
          <span className="display text-[3rem] font-semibold leading-none text-primary-foreground" aria-hidden>B</span>
        </div>
        <span className="splash-bar absolute -bottom-12 h-px w-28" aria-hidden />
      </div>
    </div>
  );
}
