import { useState, useEffect } from "react";

export const useIsAndroidApp = () => {
  const [isAndroidApp, setIsAndroidApp] = useState(false);

  useEffect(() => {
    const isTWA = document.referrer.includes('android-app://online.testio.twa');
    setIsAndroidApp(isTWA);
  }, []);

  return isAndroidApp;
};
