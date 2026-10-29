import { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Distance in px the element travels upward while fading in. */
  y?: number;
  as?: "div" | "section" | "li" | "article" | "header";
};

/**
 * Fades + lifts its children into place the first time they scroll into view.
 * Respects prefers-reduced-motion (opacity only, no movement).
 */
export const Reveal = ({ children, className, delay = 0, y = 18, as = "div" }: RevealProps) => {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : y}px)` }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay }}
    >
      {children}
    </Comp>
  );
};

const groupVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

/** Container that staggers any <RevealItem> children as the group enters view. */
export const RevealGroup = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    className={className}
    variants={groupVariants}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: "0px 0px -80px 0px" }}
  >
    {children}
  </motion.div>
);

export const RevealItem = ({ children, className }: { children: ReactNode; className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, transform: `translateY(${reduce ? 0 : 16}px)` },
        show: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.6, ease: EASE_OUT } },
      }}
    >
      {children}
    </motion.div>
  );
};
