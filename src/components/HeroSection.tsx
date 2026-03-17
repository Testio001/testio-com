import { motion } from "framer-motion";
import { ArrowRight, Upload, FileText, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import turboMascot from "@/assets/turbo-mascot.png";

const HeroSection = () => {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-turbo-glow pointer-events-none" />
      
      {/* Ambient light beams */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
        {/* Left side */}
        <div className="space-y-8">
          {/* Announcement banner */}
          <motion.a
            href="#"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-secondary border border-border hover:border-primary/30 transition-colors"
          >
            <span className="text-lg">🎉</span>
            <div className="text-sm">
              <span className="text-foreground font-semibold">We just hit 5M users!</span>
              <span className="text-muted-foreground ml-1">Read the announcement post.</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </motion.a>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-black text-foreground leading-[0.95] tracking-tight">
              Meet Turbo
              <img
                src={turboMascot}
                alt="Turbo AI mascot"
                className="inline-block w-20 h-20 md:w-28 md:h-28 ml-2 -mt-4 align-middle"
              />
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-lg"
          >
            Turn anything into notes, flashcards, quizzes, and more.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <button className="btn-turbo-primary text-lg px-8 py-4">
              Get Started - It's Free
            </button>
          </motion.div>
        </div>

        {/* Right side - PDF Upload Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="hidden lg:block"
        >
          <div className="bg-turbo-card rounded-2xl p-10 max-w-md mx-auto relative">
            <div className="text-center space-y-6">
              <p className="text-sm text-muted-foreground">Lec 5: Cellular Bio.pdf</p>
              
              <div className="relative inline-block">
                <div className="w-20 h-24 rounded-lg border-2 border-dashed border-primary/40 flex items-center justify-center bg-primary/5">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <CheckCircle2 className="absolute -bottom-1 -right-1 w-5 h-5 text-turbo-green" fill="currentColor" />
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Upload className="w-4 h-4" />
                <span>Drop your PDF here</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
