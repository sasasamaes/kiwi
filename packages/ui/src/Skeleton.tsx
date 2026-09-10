'use client';

import { motion } from 'framer-motion';
import { cn } from './utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'rectangular', width, height }: SkeletonProps) {
  const variants = {
    text: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  return (
    <motion.div
      className={cn('relative overflow-hidden bg-surface-200', variants[variant], className)}
      style={{ width, height }}
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent"
        animate={{
          translateX: ['-100%', '100%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </motion.div>
  );
}

// Preset skeleton layouts
export function OrderCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton variant="rectangular" width={80} height={24} />
        <Skeleton variant="rectangular" width={60} height={20} />
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton variant="circular" width={24} height={24} />
          <div className="flex-1">
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="40%" height={12} className="mt-1" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Skeleton variant="circular" width={24} height={24} />
          <div className="flex-1">
            <Skeleton variant="text" width="50%" height={16} />
            <Skeleton variant="text" width="35%" height={12} className="mt-1" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton variant="rectangular" className="h-12 flex-1 rounded-xl" />
        <Skeleton variant="rectangular" className="h-12 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton variant="text" width={80} height={14} />
          <Skeleton variant="text" width={60} height={32} className="mt-3" />
          <Skeleton variant="text" width={50} height={12} className="mt-2" />
        </div>
        <Skeleton variant="rectangular" width={48} height={48} className="rounded-xl" />
      </div>
    </div>
  );
}
