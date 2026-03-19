import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What is Testio?",
    a: "Testio is an AI-powered study platform that turns any document, PDF, or text into comprehensive study materials including notes, flashcards, and quizzes.",
  },
  {
    q: "How does it extract content from my PDFs?",
    a: "Just upload your PDF and Testio automatically extracts the text content and processes it with AI to create structured study materials.",
  },
  {
    q: "Can I convert my PDF textbooks into study materials?",
    a: "Yes! Upload any PDF - textbooks, research papers, lecture slides - and Testio instantly creates notes, flashcards, and quizzes from them.",
  },
  {
    q: "Is Testio free to use?",
    a: "Yes! Testio offers a generous free tier that includes note generation, flashcards, and quizzes. You can upgrade to unlock unlimited features.",
  },
  {
    q: "Does it work for STEM subjects with formulas and diagrams?",
    a: "Absolutely! Testio handles math formulas, chemical equations, physics diagrams, and code snippets perfectly.",
  },
];

const FAQSection = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-6 max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-5xl font-black text-foreground text-center mb-4 tracking-tight"
        >
          Frequently Asked Questions
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-center mb-12"
        >
          Everything you need to know about Testio
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="bg-testio-card rounded-xl px-6 border-none"
              >
                <AccordionTrigger className="text-foreground text-sm font-medium hover:no-underline py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
