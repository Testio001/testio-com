import { useEffect, useState } from "react";
import Home from "./Home";
import Onboarding from "./Onboarding";

const EntryPoint = () => {
  const [isAppContext, setIsAppContext] = useState<boolean | null>(null);

  useEffect(() => {
    // Detect Android TWA
    const isTWA = document.referrer.includes('android-app://online.testio.twa');
    
    // Detect installed PWA (standalone mode)
    const isPWA = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;

    setIsAppContext(isTWA || isPWA);
  }, []);

  // Show nothing while detecting
  if (isAppContext === null) {
    return <div className="min-h-screen bg-background" />;
  }

  // TWA/PWA users go straight to app onboarding
  if (isAppContext) {
    return <Onboarding />;
  }

  // Web visitors see the landing page
  return <Home />;
};

export default EntryPoint;
