import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  {
    title: "Harvard Pre-med",
    quote: "My bio textbook is 500 pages, but Testio makes study notes of each chapter so I can review them during commutes or workouts.",
    name: "Olivia C.",
  },
  {
    title: "MIT Education PhD",
    quote: "Testio outlines my research paper, then generates flashcards from the key points. I do the thinking, and Testio does the organizing.",
    name: "Elena R.",
  },
  {
    title: "Stanford Chemistry Major",
    quote: "Having ADHD makes focusing in organic chem lectures tough, so I upload my notes to Testio. Then it quizzes me on reactions until I actually get them.",
    name: "Sarah K.",
  },
  {
    title: "Yale Law Student",
    quote: "Case law used to overwhelm me, but Testio instantly turns my readings into flashcards and quizzes. Now I can actually keep up daily.",
    name: "Marcus O.",
  },
  {
    title: "McKinsey Consultant",
    quote: "Testio turns my meeting docs into structured notes, then I quickly edit them to highlight action items—makes follow-ups super easy.",
    name: "Jason A.",
  },
  {
    title: "Mom (4 kids, 2 dogs)",
    quote: "I always wanted to journal but was never consistent. Now I just upload my thoughts to Testio, and it turns them into neat daily entries.",
    name: "Danielle T.",
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
          <div className="text-[10px] text-primary font-semibold mb-2 uppercase tracking-wider">
            {t.title}
          </div>
          <p className={`text-muted-foreground leading-relaxed mb-3 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
            "{t.quote}"
          </p>
          <p className="text-foreground text-xs font-medium">— {t.name}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default InAppTestimonials;