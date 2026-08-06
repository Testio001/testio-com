import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote:
      "I usually had a hard time studying and memorizing anything I read, but after I started using Testio everything changed. I turn each chapter into a podcast and listen on my way to school — my last test I scored 82%.",
    name: "Testimony A.",
    role: "300L Microbiology Student",
    initials: "TA",
  },
  {
    quote:
      "Reading PDFs used to put me to sleep. Now I upload my lecture notes, get a podcast in 30 seconds, and revise while I cook. I've never felt this prepared for finals in my life.",
    name: "Bankole O.",
    role: "Final Year Law Student",
    initials: "BO",
  },
  {
    quote:
      "I used to struggle so much with studying and memorizing, especially with the volume of material we cover. Since I started using Testio, everything changed — the notes and quizzes make it actually stick.",
    name: "Damilola A.",
    role: "Medicine & Surgery Student",
    initials: "DA",
  },
  {
    quote:
      "Studying and remembering what I read was always my biggest problem. After I started using Testio everything changed — I revise with podcasts and quizzes and I finally pass with confidence.",
    name: "Gideon E.",
    role: "400L Engineering Student",
    initials: "GE",
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