import { Download, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const PWAInstallBanner = () => {
  const { canInstall, install, dismiss } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto bg-card border border-primary/30 rounded-2xl p-4 shadow-xl animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-foreground font-semibold text-sm">Install Testio</h3>
          <p className="text-muted-foreground text-xs mt-0.5">
            Add Testio to your home screen for quick access & offline support.
          </p>
          <button
            onClick={install}
            className="mt-2 bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Install App
          </button>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
