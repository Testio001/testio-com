import { Users, ShieldCheck, Globe } from "lucide-react";

const ElitePricingBanner = () => {
  return (
    <div className="mb-8 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-primary/15 px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-foreground font-bold text-sm">
              Trusted by thousands of students across the globe
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Cancel anytime — no hidden fees. Secure payments and instant access to every plan.
            </p>
          </div>
        </div>
        <div className="flex-1 sm:flex sm:justify-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-xs font-bold text-primary">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure checkout
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-xs font-bold text-primary">
              <Globe className="w-3.5 h-3.5" /> Students worldwide
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElitePricingBanner;
