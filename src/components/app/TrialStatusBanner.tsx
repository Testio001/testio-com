import { CalendarClock, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatTrialDate } from "@/lib/trial";

/** Visible reminder of the exact trial end date, driven by profiles.trial_ends_at. */
const TrialStatusBanner = ({ trialEndsAt }: { trialEndsAt: string | null }) => {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  if (!trialEndsAt || hidden) return null;
  if (new Date(trialEndsAt).getTime() <= Date.now()) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/30 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <CalendarClock className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs sm:text-sm text-foreground leading-tight">
          Your free trial ends <span className="font-bold">{formatTrialDate(trialEndsAt)}</span> — cancel anytime before then to avoid being charged.
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => navigate("/profile")}
          className="text-[11px] sm:text-xs font-semibold text-primary hover:underline whitespace-nowrap"
        >
          Manage
        </button>
        <button onClick={() => setHidden(true)} aria-label="Dismiss" className="p-1 text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TrialStatusBanner;
