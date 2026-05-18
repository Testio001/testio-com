import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();
  const hasExchanged = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Guard clause: Prevents React StrictMode from double-executing
      // and breaking the PKCE verifier state string in storage
      if (hasExchanged.current) return;

      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          hasExchanged.current = true;
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          navigate("/dashboard", { replace: true });
          return;
        }

        // Fallback: If no code query param exists, check if session is already active
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/auth", { replace: true });
        }
      } catch (err) {
        console.error("Error during auth callback exchange:", err);
        navigate("/auth", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground">Completing secure sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
