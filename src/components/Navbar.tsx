import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import testioLogo from "@/assets/testio-logo.png";

const Navbar = () => {
  const navigate = useNavigate();
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-xl border-b border-border/50"
    >
      <div className="flex items-center gap-2">
        <img src={testioLogo} alt="Testio" className="w-7 h-7" />
        <span className="text-foreground font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>testio</span>
      </div>

      <div className="hidden md:flex items-center gap-8">
        <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Blog</a>
        <a href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Careers</a>
      </div>

      <button onClick={() => navigate("/auth")} className="px-5 py-2 rounded-full border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition-colors">
        Start now
      </button>
    </motion.nav>
  );
};

export default Navbar;
