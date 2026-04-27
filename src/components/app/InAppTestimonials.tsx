import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote:
      "I was honestly failing my exams. I'd read for hours and remember nothing. I started turning every chapter into a Testio podcast and listening on my way to school — my last test I scored 82%. I almost cried.",
    name: "Amaka O.",
    role: "300L Microbiology Student",
    initials: "AO",
  },
  {
    quote:
      "Reading PDFs used to put me to sleep. Now I upload my lecture notes, get a podcast in 30 seconds, and revise while I cook. I've never felt this prepared for finals in my life.",
    name: "Daniel K.",
    role: "Final Year Law Student",
    initials: "DK",
  },
  {
    quote:
      "I have ADHD and sitting still to study is torture. The AI quizzes and podcasts make studying feel like a game. I went from a 2.4 GPA to a 3.7 in one semester. This app changed my life — no exaggeration.",
    name: "Priya S.",
    role: "Pre-Med, 2nd Year",
    initials: "PS",
  },
  {
    quote:
      "I'm a working mum trying to finish my MBA. I have zero free time. Testio turns my readings into podcasts I listen to while doing dishes. I passed my last two courses with distinction. Worth every naira.",
    name: "Funmi A.",
    role: "MBA Candidate",
    initials: "FA",
  },
];

interface InAppTestimonialsProps {
  variant?: "card" | "compact";
  className?: string;
}

const InAppTestimonials = ({ variant = "card", className = "" }: InAppTestimonialsProps) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  const t = testimonials[index];

  return (
    <div className={`bg-testio-card rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Quote className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            What students say
          </span>
        </div>
        <div className="flex gap-1">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show testimonial ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
        >
          <p className={`text-muted-foreground leading-relaxed mb-4 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
            "{t.quote}"
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/15 text-primary text-xs font-bold">
              {t.initials}
            </div>
            <div>
              <p className="text-foreground text-xs font-semibold">{t.name}</p>
              <p className="text-muted-foreground text-[11px]">{t.role}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default InAppTestimonials;