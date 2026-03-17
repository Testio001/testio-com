import { motion } from "framer-motion";
import { Zap } from "lucide-react";

const Navbar = () => {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-xl border-b border-border/50"
    >
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" fill="currentColor" />
        <span className="text-foreground font-bold text-lg">turbo ai</span>
      </div>

      <div className="hidden md:flex items-center gap-8">
        <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Blog</a>
        <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Careers</a>
      </div>

      <button className="px-5 py-2 rounded-full border border-border text-foreground text-sm font-medium hover:bg-secondary transition-colors">
        Start now
      </button>
    </motion.nav>
  );
};

export default Navbar;
