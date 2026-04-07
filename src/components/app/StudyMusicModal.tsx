import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Music, Loader2, CheckCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const genres = ["Pop", "Lo-fi", "Hip-Hop", "Classical"];
const dailyOptions = ["Yes, definitely!", "Maybe sometimes", "Not sure yet"];

const StudyMusicModal = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [genre, setGenre] = useState("");
  const [daily, setDaily] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!genre || !daily || !email.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("study_music_waitlist" as any).insert({
      genre,
      would_use_daily: daily,
      email: email.trim(),
      user_id: user?.id || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      return;
    }
    setSubmitted(true);
    toast({ title: "🎵 You're on the list!", description: "We'll notify you when Study Music launches." });
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setGenre("");
      setDaily("");
      setEmail("");
      setSubmitted(false);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Study Music
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="w-12 h-12 text-primary mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">You're on the waitlist!</h3>
            <p className="text-sm text-muted-foreground">We'll send you an email when Study Music is ready.</p>
            <Button onClick={() => handleClose(false)} className="mt-2">Close</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Transform your notes into music. We are currently developing a feature to turn your study material into catchy songs to help with memorization.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">What genre do you prefer?</label>
              <div className="grid grid-cols-2 gap-2">
                {genres.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenre(g)}
                    className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
                      genre === g
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Would you use this daily?</label>
              <div className="space-y-2">
                {dailyOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setDaily(opt)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                      daily === opt
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email for waitlist</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Join the Waitlist
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudyMusicModal;
