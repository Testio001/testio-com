import { motion } from "framer-motion";

const logos = [
  "Google", "Harvard", "Goldman Sachs", "MIT", "McKinsey",
  "Yale", "Deloitte", "Duke", "Oxford", "Princeton",
];

const LogoBar = () => {
  return (
    <section className="py-16 border-t border-border/50">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center text-sm text-muted-foreground mb-10"
      >
        Testio is trusted by students and professionals at...
      </motion.p>

      <div className="overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
        
        <div className="flex logo-scroll gap-16 items-center whitespace-nowrap">
          {[...logos, ...logos].map((name, i) => (
            <span
              key={i}
              className="text-muted-foreground/50 font-semibold text-lg shrink-0 tracking-wide"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LogoBar;
