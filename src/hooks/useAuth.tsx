import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);

      // Send a one-time welcome email on the first SIGNED_IN after a brand-new
      // account is created (catches Google OAuth signups and any other path
      // that didn't go through the email/password form). Idempotent because
      // send-transactional-email dedupes on idempotencyKey per user.
      if (event === "SIGNED_IN" && session?.user) {
        const user = session.user;
        // Track site visit (once per browser session)
        try {
          const visitKey = `testio-visit-counted-${user.id}`;
          if (typeof window !== "undefined" && !window.sessionStorage.getItem(visitKey)) {
            window.sessionStorage.setItem(visitKey, "1");
            supabase.rpc("increment_user_visit").then(({ error }) => {
              if (error) console.error("increment_user_visit failed", error);
            });
          }
        } catch (e) {
          console.error("visit tracking failed", e);
        }

        const createdAt = new Date(user.created_at).getTime();
        const isFresh = Date.now() - createdAt < 5 * 60 * 1000;
        const flagKey = `testio-welcome-sent-${user.id}`;
        if (isFresh && typeof window !== "undefined" && !window.localStorage.getItem(flagKey)) {
          window.localStorage.setItem(flagKey, "1");
          const displayName =
            (user.user_metadata?.display_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            user.email?.split("@")[0] ||
            "there";
          supabase.functions
            .invoke("send-transactional-email", {
              body: {
                templateName: "welcome",
                recipientEmail: user.email,
                idempotencyKey: `welcome-${user.id}`,
                templateData: { displayName },
              },
            })
            .catch((err) => console.error("welcome email enqueue failed", err));
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
