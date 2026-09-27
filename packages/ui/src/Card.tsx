// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated' | 'bordered' | 'gradient';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

function Card({
  className,
  variant = 'default',
  hover = false,
  padding = 'md',
  children,
  ...props
}: CardProps) {
  const variants = {
    default: cn('bg-white', 'shadow-soft', 'rounded-2xl'),
    glass: cn('glass-strong', 'border border-white/30', 'shadow-soft-md', 'rounded-2xl'),
    elevated: cn('bg-white', 'shadow-soft-lg', 'rounded-2xl', 'ring-1 ring-surface-100'),
    bordered: cn('bg-white', 'border border-surface-200', 'shadow-soft', 'rounded-2xl'),
    gradient: cn('bg-kiwi-gradient', 'text-white', 'shadow-kiwi', 'rounded-2xl'),
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        variants[variant],
        paddings[padding],
        hover && 'transition-all duration-300 hover:shadow-soft-xl hover:-translate-y-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg font-display font-semibold text-surface-800', className)} {...props}>
      {children}
    </h3>
  );
}

function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-surface-500', className)} {...props}>
      {children}
    </p>
  );
}

function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-4 flex items-center border-t border-surface-100 pt-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Stat Card - For dashboard metrics
interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: ReactNode;
  color?: 'kiwi' | 'gold' | 'bark' | 'blue';
}

function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  color = 'kiwi',
}: StatCardProps) {
  const colors = {
    kiwi: {
      bg: 'bg-kiwi-50',
      icon: 'text-kiwi-500',
      ring: 'ring-kiwi-100',
    },
    gold: {
      bg: 'bg-gold-50',
      icon: 'text-gold-500',
      ring: 'ring-gold-100',
    },
    bark: {
      bg: 'bg-bark-50',
      icon: 'text-bark-500',
      ring: 'ring-bark-100',
    },
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-500',
      ring: 'ring-blue-100',
    },
  };

  const changeColors = {
    positive: 'text-kiwi-700 bg-kiwi-50',
    negative: 'text-red-600 bg-red-50',
    neutral: 'text-surface-500 bg-surface-50',
  };

  return (
    <Card hover>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-surface-500">{title}</p>
          <p className="mt-2 text-3xl font-display font-bold text-surface-800">{value}</p>
          {change && (
            <p
              className={cn(
                'mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                changeColors[changeType],
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl ring-1',
            colors[color].bg,
            colors[color].ring,
            colors[color].icon,
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, StatCard };
