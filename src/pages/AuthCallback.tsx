import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution in development mode
    if (hasProcessed.current) return;

    const handleAuthExchange = async () => {
      try {
        // 1. Check for PKCE code in the URL query parameters (?code=...)
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          hasProcessed.current = true;
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          navigate("/dashboard", { replace: true });
          return;
        }

        // 2. Fallback: check if a session already exists instantly
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate("/dashboard", { replace: true });
        } else {
          // Fallback timeout in case of slow connection parsing
          setTimeout(async () => {
            const { data: retryData } = await supabase.auth.getSession();
            if (retryData.session) {
              navigate("/dashboard", { replace: true });
            } else {
              navigate("/auth", { replace: true });
            }
          }, 2000);
        }
      } catch (error: any) {
        console.error("Error exchanging auth code:", error);
        toast({
          title: "Sign in failed",
          description: error.message || "Could not exchange authorization code.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
      }
    };

    handleAuthExchange();
  }, [navigate, toast]);

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
