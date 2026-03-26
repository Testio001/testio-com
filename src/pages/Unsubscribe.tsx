import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { MailX, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import testioLogo from "@/assets/testio-logo.png";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
        headers: { apikey: anonKey },
      });
      const data = await res.json();
      if (!res.ok) {
        setState("invalid");
      } else if (data.valid === false && data.reason === "already_unsubscribed") {
        setState("already");
      } else if (data.valid) {
        setState("valid");
      } else {
        setState("invalid");
      }
    } catch {
      setState("error");
    }
  };

  const handleUnsubscribe = async () => {
    setState("loading");
    try {
      const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setState("success");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={testioLogo} alt="Testio" className="w-10 h-10" />
          <span className="text-foreground font-bold text-2xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>testio</span>
        </div>

        <div className="bg-testio-card rounded-2xl p-8">
          {state === "loading" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground">Processing...</p>
            </div>
          )}

          {state === "valid" && (
            <div className="flex flex-col items-center gap-4">
              <MailX className="w-12 h-12 text-muted-foreground" />
              <h1 className="text-xl font-bold text-foreground">Unsubscribe from emails?</h1>
              <p className="text-muted-foreground text-sm">
                You'll stop receiving app notification emails from Testio. Auth emails (password reset, verification) will still be sent.
              </p>
              <button onClick={handleUnsubscribe} className="btn-testio-primary mt-2">
                Confirm Unsubscribe
              </button>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="w-12 h-12 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Unsubscribed</h1>
              <p className="text-muted-foreground text-sm">You've been unsubscribed from Testio notification emails.</p>
            </div>
          )}

          {state === "already" && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="w-12 h-12 text-muted-foreground" />
              <h1 className="text-xl font-bold text-foreground">Already Unsubscribed</h1>
              <p className="text-muted-foreground text-sm">You've already unsubscribed from these emails.</p>
            </div>
          )}

          {(state === "invalid" || state === "error") && (
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <h1 className="text-xl font-bold text-foreground">Invalid Link</h1>
              <p className="text-muted-foreground text-sm">This unsubscribe link is invalid or has expired.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Unsubscribe;
