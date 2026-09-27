// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Widgets ligeros que antes vivían en Charts.tsx — movidos aquí para que
 * recharts (~900KB) NO entre en el bundle inicial de ninguna app: solo
 * quien importe los gráficos reales paga el peso. Mismas firmas, cero
 * cambios para los consumidores.
 */

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: string;
  color?: string;
}

export function StatCard({ title, value, change, icon, color = '#22c55e' }: StatCardProps) {
  return (
    <motion.div
      className="rounded-2xl glass p-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-500 dark:text-surface-400">{title}</p>
          <p className="text-2xl font-bold text-surface-800 dark:text-surface-100 mt-1">{value}</p>
          {change !== undefined && (
            <div
              className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}
            >
              <span>{change >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(change)}%</span>
              <span className="text-surface-500 dark:text-surface-400">vs semana anterior</span>
            </div>
          )}
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

// Period Selector Component
interface PeriodSelectorProps {
  selected: string;
  onSelect: (period: string) => void;
}

export function PeriodSelector({ selected, onSelect }: PeriodSelectorProps) {
  const periods = [
    { id: 'today', label: 'Hoy' },
    { id: 'week', label: 'Semana' },
    { id: 'month', label: 'Mes' },
    { id: 'quarter', label: 'Trimestre' },
    { id: 'year', label: 'Año' },
  ];

  return (
    <div className="flex gap-2 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl">
      {periods.map((period) => (
        <motion.button
          key={period.id}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selected === period.id
              ? 'bg-kiwi-700 text-white shadow-md'
              : 'text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
          }`}
          onClick={() => onSelect(period.id)}
          whileTap={{ scale: 0.95 }}
        >
          {period.label}
        </motion.button>
      ))}
    </div>
  );
}

export { COLORS };
