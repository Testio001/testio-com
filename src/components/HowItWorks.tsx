import { motion } from "framer-motion";

const steps = [
  {
    num: "1",
    title: "Upload Your Content",
    desc: "Record lectures live or upload PDFs, videos, audio files, and documents. Works with any format you need.",
  },
  {
    num: "2",
    title: "Let AI Process",
    desc: "Our AI transcribes and analyzes your content, identifying key concepts and creating structured editable notes.",
  },
  {
    num: "3",
    title: "Get Study Materials",
    desc: "Receive comprehensive notes, flashcards, quizzes, and podcasts tailored to your learning needs.",
  },
  {
    num: "4",
    title: "Study & Succeed",
    desc: "Access materials anywhere, share with classmates, and use built-in study modes to ace your exams.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-5xl font-black text-foreground text-center mb-4 tracking-tight"
        >
          How It Works - It's Simple.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto text-lg"
        >
          Transform any PDF, YouTube video, or audio into beautiful notes and study tools in four simple steps.
        </motion.p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-5">
                <span className="text-primary font-bold text-lg">{step.num}</span>
              </div>
              <h3 className="text-foreground font-bold mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
