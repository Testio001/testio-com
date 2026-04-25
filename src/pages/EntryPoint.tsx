import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Home from "./Home";
import Onboarding from "./Onboarding";
import { useAuth } from "@/hooks/useAuth";

const EntryPoint = () => {
  const [isAppContext, setIsAppContext] = useState<boolean | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Detect Android TWA
    const isTWA = document.referrer.includes('android-app://online.testio.twa');
    
    // Detect installed PWA (standalone mode)
    const isPWA = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;

    setIsAppContext(isTWA || isPWA);
  }, []);

  // Show nothing while detecting context or auth
  if (isAppContext === null || authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  // Authenticated users go straight to the dashboard, regardless of context
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // TWA/PWA users go straight to app onboarding
  if (isAppContext) {
    return <Onboarding />;
  }

  // Web visitors see the landing page
  return <Home />;
};

export default EntryPoint;
