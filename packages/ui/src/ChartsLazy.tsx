// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * Implementaciones REALES de los gráficos (recharts ~900KB). Este módulo solo
 * se descarga vía next/dynamic cuando una página renderiza un gráfico —
 * copiado VERBATIM del Charts.tsx original para preservar formato es-CR, ₡ y props.
 */
import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

import { fmtDayShort, fmtDayLong } from './chartDates';

interface ChartProps {
  data: any[];
  height?: number;
  className?: string;
}

// Line Chart Component
export function LineChartComponent({ data, height = 300, className = '' }: ChartProps) {
  return (
    <motion.div
      className={`rounded-2xl glass p-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="date"
            stroke="#71717a"
            fontSize={12}
            minTickGap={24}
            tickFormatter={(value) => fmtDayShort(value)}
          />
          <YAxis stroke="#71717a" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: 'none',
              borderRadius: '12px',
              color: '#fafafa',
            }}
            labelFormatter={(value) => fmtDayLong(value)}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#22c55e"
            strokeWidth={3}
            dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// Area Chart Component
export function AreaChartComponent({ data, height = 300, className = '' }: ChartProps) {
  return (
    <motion.div
      className={`rounded-2xl glass p-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="date"
            stroke="#71717a"
            fontSize={12}
            minTickGap={24}
            tickFormatter={(value) => fmtDayShort(value)}
          />
          <YAxis
            stroke="#71717a"
            fontSize={12}
            tickFormatter={(value) => `₡${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: 'none',
              borderRadius: '12px',
              color: '#fafafa',
            }}
            formatter={(value) => [`₡${Number(value ?? 0).toLocaleString()}`, 'Ingresos']}
            labelFormatter={(value) => fmtDayLong(value)}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#22c55e"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// Bar Chart Component
export function BarChartComponent({ data, height = 300, className = '' }: ChartProps) {
  return (
    <motion.div
      className={`rounded-2xl glass p-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
          <YAxis stroke="#71717a" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: 'none',
              borderRadius: '12px',
              color: '#fafafa',
            }}
          />
          <Bar dataKey="value" fill="#22c55e" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// Pie Chart Component
interface PieChartProps extends ChartProps {
  innerRadius?: number;
  outerRadius?: number;
}

export function PieChartComponent({
  data,
  height = 300,
  className = '',
  innerRadius = 60,
  outerRadius = 100,
}: PieChartProps) {
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    name,
  }: any) => {
    // Las porciones chicas (<6%) no llevan etiqueta: el texto blanco se sale
    // del segmento y se monta sobre el resto (el valor igual está en el tooltip).
    if (!Number.isFinite(percent) || percent < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <motion.div
      className={`rounded-2xl glass p-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: 'none',
              borderRadius: '12px',
              color: '#fafafa',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ paddingTop: 8, lineHeight: '24px' }}
            formatter={(value) => (
              <span className="text-surface-600 dark:text-surface-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// Multi-Line Chart Component
interface MultiLineChartProps {
  data: any[];
  lines: { key: string; color: string; name: string }[];
  height?: number;
  className?: string;
}

export function MultiLineChartComponent({
  data,
  lines,
  height = 300,
  className = '',
}: MultiLineChartProps) {
  return (
    <motion.div
      className={`rounded-2xl glass p-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="date"
            stroke="#71717a"
            fontSize={12}
            minTickGap={24}
            tickFormatter={(value) => fmtDayShort(value)}
          />
          <YAxis stroke="#71717a" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: 'none',
              borderRadius: '12px',
              color: '#fafafa',
            }}
          />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={line.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
