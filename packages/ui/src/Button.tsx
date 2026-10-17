// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass' | 'gradient';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading,
      leftIcon,
      rightIcon,
      fullWidth,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    // Base styles
    const baseStyles = cn(
      'inline-flex items-center justify-center font-medium transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'active:scale-[0.97] press',
      fullWidth && 'w-full',
    );

    // Variants with modern effects
    const variants = {
      primary: cn(
        'bg-kiwi-700 text-white',
        'hover:bg-kiwi-800 hover:shadow-card',
        'focus-visible:ring-kiwi-600',
        'shadow-soft-md',
        'rounded-xl',
      ),
      secondary: cn(
        'bg-surface-100 text-surface-700',
        'hover:bg-surface-200 hover:shadow-soft',
        'focus-visible:ring-surface-400',
        'border border-surface-200',
        'rounded-xl',
      ),
      ghost: cn(
        'text-surface-600',
        'hover:bg-surface-100 hover:text-surface-900',
        'focus-visible:ring-surface-400',
        'rounded-xl',
      ),
      danger: cn(
        'bg-red-500 text-white',
        'hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/25',
        'focus-visible:ring-red-500',
        'rounded-xl',
      ),
      glass: cn(
        'glass-strong text-surface-700',
        'border border-white/30',
        'hover:bg-white/90 hover:shadow-soft-lg',
        'focus-visible:ring-kiwi-600',
        'rounded-xl',
      ),
      gradient: cn(
        'bg-kiwi-gradient text-white',
        'hover:shadow-card',
        'focus-visible:ring-kiwi-600',
        'rounded-xl',
      ),
    };

    // Sizes
    const sizes = {
      xs: 'h-7 px-2.5 text-xs gap-1.5',
      sm: 'h-9 px-3.5 text-sm gap-2',
      md: 'h-11 px-5 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2.5',
      xl: 'h-14 px-8 text-lg gap-3',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Cargando...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
