'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { buttonVariants, buttonGlow } from './animations';
import { cn } from './utils';

interface AnimatedButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass' | 'gradient';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function AnimatedButton({
  variant = 'primary',
  size = 'md',
  isLoading,
  children,
  className,
  disabled,
  ...props
}: AnimatedButtonProps) {
  const variants = {
    primary: 'bg-kiwi-500 text-white hover:bg-kiwi-600 shadow-kiwi',
    secondary: 'bg-surface-100 text-surface-700 hover:bg-surface-200 border border-surface-200',
    ghost: 'text-surface-600 hover:bg-surface-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    glass: 'glass-strong text-surface-700 border border-white/30',
    gradient: 'bg-kiwi-gradient text-white shadow-kiwi-lg',
  };

  const sizes = {
    sm: 'h-9 px-4 text-sm rounded-xl',
    md: 'h-11 px-6 text-sm rounded-xl',
    lg: 'h-12 px-8 text-base rounded-xl',
    xl: 'h-14 px-10 text-lg rounded-2xl',
  };

  return (
    <motion.button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      variants={buttonVariants}
      initial="idle"
      whileHover={disabled ? 'idle' : 'hover'}
      whileTap={disabled ? 'idle' : 'tap'}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <motion.div
          className="mr-2 h-4 w-4 rounded-full border-2 border-current border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : null}
      {children}
    </motion.button>
  );
}
