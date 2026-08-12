import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Sparkles, Flame, Brain, Mic, Trophy, Heart, ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: string;
  endsAt?: string | null;
  cancelling: boolean;
  onConfirm: () => void;
  onStay: () => void;
}

const CONFIRM_PHRASE = "CANCEL MY PLAN";

const CancelRetentionModal = ({ open, onOpenChange, plan, endsAt, cancelling, onConfirm, onStay }: Props) => {
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(0);
      setReason(null);
      setPhrase("");
      setChecks({});
    }, 200);
  };

  const stay = () => {
    onStay();
    close();
  };

  const planLabel = plan === "pro" ? "Pro" : plan === "basic" ? "Basic" : plan === "scholar" ? "Scholar" : "paid";
  const allChecked = ["notes", "podcasts", "streak"].every((k) => checks[k]);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md bg-testio-card border-border p-0 overflow-hidden">
        {/* progress */}
        <div className="flex gap-1 px-6 pt-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">
          {step === 0 && (
            <>
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Wait — before you go</h2>
              <p className="text-sm text-muted-foreground">
                You're on <span className="text-foreground font-medium">{planLabel}</span>. Cancelling means you go back to
                <span className="text-foreground font-medium"> 1 upload per month</span> and lose the tools you've been studying with.
              </p>
              <div className="space-y-2">
                {[
                  { icon: Brain, t: "AI notes, quizzes & flashcards", d: "Generated from your own material in seconds" },
                  { icon: Mic, t: "Full-length study podcasts", d: "Free tier only gets a 1-minute preview" },
                  { icon: Flame, t: "Your streak & streak freezes", d: "Streak protection ends with your plan" },
                  { icon: Trophy, t: "Leaderboard standing", d: "Free accounts fall behind fast" },
                ].map(({ icon: Icon, t, d }) => (
                  <div key={t} className="flex gap-3 items-start bg-background/50 rounded-lg p-3 border border-border">
                    <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">{t}</p>
                      <p className="text-[11px] text-muted-foreground">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={stay} className="btn-testio-primary w-full text-sm !py-2.5">
                Keep my {planLabel} plan
              </button>
              <button onClick={() => setStep(1)} className="w-full text-xs text-muted-foreground hover:text-foreground">
                I still want to cancel <ArrowRight className="w-3 h-3 inline" />
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Help us understand why</h2>
              <p className="text-sm text-muted-foreground">Pick the closest reason — we may already have a fix for it.</p>
              <div className="space-y-2">
                {[
                  { id: "price", label: "It's too expensive", fix: "Downgrading to a cheaper plan keeps your notes, streak and podcasts alive for less." },
                  { id: "usage", label: "I'm not using it enough", fix: "Exams come in waves. Pausing your usage costs nothing — cancelling deletes your momentum." },
                  { id: "features", label: "Missing something I need", fix: "Tell us at testio4171@gmail.com — most requested features ship within weeks." },
                  { id: "break", label: "I'm on a study break", fix: "Your streak freezes and stored material stay intact while you're on a paid plan." },
                  { id: "other", label: "Something else", fix: "We'd genuinely like to hear it: testio4171@gmail.com" },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className={`w-full text-left rounded-lg p-3 border text-xs transition-colors ${
                      reason === r.id ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.label}
                    {reason === r.id && <p className="text-[11px] text-muted-foreground mt-1.5">{r.fix}</p>}
                  </button>
                ))}
              </div>
              <button onClick={stay} className="btn-testio-primary w-full text-sm !py-2.5">
                Actually, I'll stay
              </button>
              <div className="flex items-center justify-between">
                <button onClick={() => setStep(0)} className="text-xs text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-3 h-3 inline" /> Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!reason}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  Continue cancelling <ArrowRight className="w-3 h-3 inline" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Here's exactly what you lose</h2>
              <p className="text-sm text-muted-foreground">
                Confirm each one so there are no surprises{endsAt ? ` after ${new Date(endsAt).toLocaleDateString()}` : ""}.
              </p>
              <div className="space-y-2">
                {[
                  { id: "notes", label: "My uploads drop to 1 per month and older material may be removed after 1–2 months" },
                  { id: "podcasts", label: "My podcasts become 1-minute previews and expire" },
                  { id: "streak", label: "I lose streak freezes and my leaderboard position" },
                ].map((c) => (
                  <label key={c.id} className="flex gap-3 items-start bg-background/50 rounded-lg p-3 border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!checks[c.id]}
                      onChange={(e) => setChecks((p) => ({ ...p, [c.id]: e.target.checked }))}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="text-xs text-muted-foreground">{c.label}</span>
                  </label>
                ))}
              </div>
              <button onClick={stay} className="btn-testio-primary w-full text-sm !py-2.5">
                Keep everything — don't cancel
              </button>
              <div className="flex items-center justify-between">
                <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-3 h-3 inline" /> Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!allChecked}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  I understand, continue <ArrowRight className="w-3 h-3 inline" />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Final step</h2>
              <p className="text-sm text-muted-foreground">
                Type <span className="text-foreground font-semibold">{CONFIRM_PHRASE}</span> to cancel your subscription. You keep access until the end of the current billing period.
              </p>
              <input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
              />
              <button onClick={stay} className="btn-testio-primary w-full text-sm !py-2.5">
                Never mind, keep my plan
              </button>
              <button
                onClick={onConfirm}
                disabled={phrase.trim().toUpperCase() !== CONFIRM_PHRASE || cancelling}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
              >
                {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                Cancel my subscription
              </button>
              <button onClick={() => setStep(2)} className="w-full text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3 h-3 inline" /> Back
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancelRetentionModal;