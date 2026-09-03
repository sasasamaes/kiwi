'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cardVariants } from './animations';
import { cn } from './utils';

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'glass' | 'elevated' | 'gradient';
  hover?: boolean;
  children: React.ReactNode;
}

export function AnimatedCard({
  variant = 'default',
  hover = true,
  children,
  className,
  ...props
}: AnimatedCardProps) {
  const variants = {
    default: 'bg-white shadow-soft rounded-2xl',
    glass: 'glass-strong border border-white/30 shadow-soft-md rounded-2xl',
    elevated: 'bg-white shadow-soft-lg rounded-2xl ring-1 ring-surface-100',
    gradient: 'bg-kiwi-gradient text-white shadow-kiwi rounded-2xl',
  };

  return (
    <motion.div
      className={cn(variants[variant], className)}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={hover ? 'hover' : undefined}
      whileTap="tap"
      {...props}
    >
      {children}
    </motion.div>
  );
}
