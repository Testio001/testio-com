import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";

/**
 * "Receipt" style comparison shown on the pricing page.
 * Tutoring vs. Testio Pro — localized for USD or NGN.
 */
const ComparisonReceipt = () => {
  const { currency } = useCurrency();

  const isNgn = currency === "NGN";
  const tutorRate = isNgn ? "₦8,000/hr" : "$40/hr";
  const tutorMonthly = isNgn ? "₦64,000" : "$320";
  const proPrice = isNgn ? "₦14,990" : "$9.99";
  const proPeriod = isNgn ? "/30 days" : "/mo";
  const savings = isNgn ? "₦49,010" : "$310";
  const multiplier = isNgn ? "~4×" : "~32×";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="max-w-md mx-auto my-12"
    >
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-semibold px-3 py-1 rounded-full mb-2">
          💡 Math that pays
        </div>
        <h3 className="text-foreground font-bold text-lg sm:text-xl">Compare it to a real tutor</h3>
      </div>

      <div className="bg-card border-2 border-dashed border-border rounded-2xl p-5 sm:p-6 font-mono">
        <p className="text-center text-[10px] text-muted-foreground mb-4 tracking-wider">
          ━━━━ STUDY COST RECEIPT ━━━━
        </p>

        <Line label="Private tutor" value={tutorRate} sub="(market rate, 1 session/week ≈ 8 hrs/mo)" />
        <Line label="Monthly tutoring" value={tutorMonthly} muted />
        <div className="border-t border-dashed border-border my-3" />
        <Line label="Testio Pro" value={`${proPrice}${proPeriod}`} highlight />
        <Line label="Unlimited quizzes, podcasts, AI tutor" value="" muted small />

        <div className="border-t-2 border-foreground/20 my-3" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground font-bold">YOU SAVE</span>
          <span className="text-primary font-bold">{savings}/mo</span>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-2">
          That's {multiplier} cheaper — and Testio is available 24/7
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
        <div className="bg-secondary/40 rounded-xl p-3">
          <p className="font-semibold text-muted-foreground mb-2 flex items-center gap-1"><X className="w-3 h-3" /> Tutor</p>
          <ul className="space-y-1 text-muted-foreground text-[11px]">
            <li>• Schedule appointments</li>
            <li>• Limited to 1 subject</li>
            <li>• Pay per hour</li>
          </ul>
        </div>
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-3">
          <p className="font-semibold text-primary mb-2 flex items-center gap-1"><Check className="w-3 h-3" /> Testio Pro</p>
          <ul className="space-y-1 text-foreground text-[11px]">
            <li>• Instant, anytime</li>
            <li>• Every subject</li>
            <li>• One flat price</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

const Line = ({
  label, value, muted, highlight, sub, small,
}: { label: string; value: string; muted?: boolean; highlight?: boolean; sub?: string; small?: boolean }) => (
  <div className="mb-1">
    <div className={`flex items-baseline justify-between gap-2 ${small ? "text-[10px]" : "text-xs sm:text-sm"}`}>
      <span className={highlight ? "text-foreground font-semibold" : muted ? "text-muted-foreground" : "text-foreground"}>{label}</span>
      {value && (
        <span className={`tabular-nums ${highlight ? "text-primary font-bold" : muted ? "text-muted-foreground" : "text-foreground font-semibold"}`}>
          {value}
        </span>
      )}
    </div>
    {sub && <p className="text-[10px] text-muted-foreground italic">{sub}</p>}
  </div>
);

export default ComparisonReceipt;