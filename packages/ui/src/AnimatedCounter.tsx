'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 1.5,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: AnimatedCounterProps) {
  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  const display = useTransform(spring, (current) =>
    `${prefix}${current.toFixed(decimals)}${suffix}`
  );

  const [displayValue, setDisplayValue] = useState(
    `${prefix}0${suffix}`
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      setDisplayValue(v);
    });
    return unsubscribe;
  }, [display]);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, scale: 0.5, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
    >
      {displayValue}
    </motion.span>
  );
}
