import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

/**
 * Motion primitives — premium interaction defaults shared across MixOrder.
 * Kept intentionally small: a couple of hover/tap presets so pages stay
 * consistent without pulling framer-motion boilerplate into every file.
 */

const spring = { type: "spring" as const, stiffness: 380, damping: 26, mass: 0.6 };

export const MotionButton = forwardRef<HTMLButtonElement, HTMLMotionProps<"button">>(
  function MotionButton(props, ref) {
    return (
      <motion.button
        ref={ref}
        whileHover={{ y: -2, scale: 1.015 }}
        whileTap={{ scale: 0.97 }}
        transition={spring}
        {...props}
      />
    );
  },
);

export const MotionCard = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  function MotionCard(props, ref) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        {...props}
      />
    );
  },
);

export { motion, spring };
