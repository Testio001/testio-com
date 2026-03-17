import { motion } from "framer-motion";

const testimonials = [
  {
    title: "Harvard Pre-med",
    quote: "My bio textbook is 500 pages, but Turbo AI makes podcasts of each chapter so I can listen during my long commutes or workouts.",
    name: "Olivia C.",
  },
  {
    title: "MIT Education PhD",
    quote: "Turbo AI outlines my research paper, then I go use my voice to tell it how I want each paragraph. I do the thinking, and Turbo AI does the writing.",
    name: "Elena R.",
  },
  {
    title: "Stanford Chemistry Major",
    quote: "Having ADHD makes focusing in organic chem lectures tough, so I record every class with Turbo. Then it quizzes me on reactions until I actually get them.",
    name: "Sarah K.",
  },
  {
    title: "Yale Law Student",
    quote: "Case law used to overwhelm me, but Turbo AI instantly turns my readings into flashcards and quizzes. Now I can actually keep up daily.",
    name: "Marcus O.",
  },
  {
    title: "McKinsey Consultant",
    quote: "Turbo AI records my meetings into notes, then I quickly edit them to highlight action items—makes follow-ups super easy.",
    name: "Jason A.",
  },
  {
    title: "Mom (4 kids, 2 dogs)",
    quote: "I always wanted to journal but was never consistent. Now I just talk to Turbo AI for 2 mins every night, and it turns my thoughts into neat daily entries.",
    name: "Danielle T.",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-5xl font-black text-foreground text-center mb-16 tracking-tight"
        >
          Testimonials
        </motion.h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-turbo-card rounded-2xl p-6"
            >
              <div className="text-xs text-primary font-semibold mb-4 uppercase tracking-wider">{t.title}</div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">"{t.quote}"</p>
              <p className="text-foreground text-sm font-medium">— {t.name}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
