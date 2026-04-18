import { Sparkles } from "lucide-react";

const ElitePricingBanner = () => {
  return (
    <div className="mb-8 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-primary/15 px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-foreground font-bold text-sm">
              🔥 Elite Member Pricing — Locked for the first 1,000 members
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Once full, Basic, Pro & Scholar all move to normal price. Lock yours in now.
            </p>
          </div>
        </div>
        <div className="flex-1 sm:flex sm:justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30">
            <span className="text-xs font-bold text-primary">997 / 1000 slots taken</span>
            <div className="w-20 h-1.5 bg-primary/20 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: "99.7%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElitePricingBanner;
