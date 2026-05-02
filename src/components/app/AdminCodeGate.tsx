import { ReactNode, useEffect, useState } from "react";
import { LockKeyhole, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AdminCodeGateProps = {
  title: string;
  description: string;
  children: () => ReactNode;
};

const AdminCodeGate = ({ title, description, children }: AdminCodeGateProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) { setChecking(false); setIsAdmin(false); return; }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!cancelled) {
        setIsAdmin(!error && !!data);
        setChecking(false);
      }
    };
    if (!authLoading) check();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin) return <>{children()}</>;

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/60">
              <LockKeyhole className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              {user
                ? "Your account does not have admin access."
                : "Sign in with an admin account to continue."}
            </p>
            <Button onClick={() => navigate(user ? "/dashboard" : "/auth")} className="w-full">
              {user ? "Back to dashboard" : "Sign in"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCodeGate;