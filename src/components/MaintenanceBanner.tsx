import { Wrench } from "lucide-react";

const MaintenanceBanner = () => (
  <div className="fixed top-0 inset-x-0 z-[60] bg-primary text-primary-foreground text-xs sm:text-sm py-2 px-3 flex items-center justify-center gap-2 shadow-md">
    <Wrench className="w-3.5 h-3.5 shrink-0" />
    <span className="font-medium text-center">
      We're upgrading our database — some features may be briefly unavailable. We'll be back shortly.
    </span>
  </div>
);

export default MaintenanceBanner;