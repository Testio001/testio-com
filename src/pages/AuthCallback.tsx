import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // 1. Parse the URL query parameters to look for the PKCE code
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          // 2. Explicitly exchange the single-use auth code for an active user session
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          navigate("/dashboard", { replace: true });
          return;
        }

        // 3. Fallback check: see if a session already exists natively
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/auth", { replace: true });
        }
      } catch (error) {
        console.error("Error exchanging code for session:", error);
        navigate("/auth", { replace: true });
      }
    };

    handleAuthCallback();
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
