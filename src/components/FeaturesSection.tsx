import { motion } from "framer-motion";
import { FileText, Users, BookOpen } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Turn anything into an editable note.",
    description: "Transform PDFs, videos, and audio into notes you can edit and share.",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    icon: Users,
    title: "Live collaboration",
    description: "Turbo AI actively works alongside you — editing your doc, highlighting issues, adding AI comments.",
    gradient: "from-primary/15 to-primary/5",
  },
  {
    icon: BookOpen,
    title: "Study smarter, not harder.",
    description: "Generate quizzes, podcasts, flashcards from your notes. Students love us.",
    gradient: "from-primary/20 to-primary/5",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-4"
        >
          <a href="#" className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:underline mb-6">
            We're now Turbo AI (formerly Turbolearn AI) →
          </a>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-5xl font-black text-foreground text-center mb-4 tracking-tight"
        >
          The last notetaker you'll ever need
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto text-lg"
        >
          Turbo AI records live, edits, comments and collaborates like a real assistant.
        </motion.p>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group bg-turbo-card rounded-2xl p-8 hover:border-primary/30 transition-all duration-300 cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6`}>
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
