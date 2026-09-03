'use client';

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
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
            }}
          />
          <YAxis stroke="#71717a" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: 'none',
              borderRadius: '12px',
              color: '#fafafa',
            }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
            }}
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
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
            }}
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
            formatter={(value: number) => [`₡${value.toLocaleString()}`, 'Ingresos']}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
            }}
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
  outerRadius = 100 
}: PieChartProps) {
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
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
            formatter={(value) => <span className="text-surface-600 dark:text-surface-400">{value}</span>}
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
  className = '' 
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
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
            }}
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

// Stat Card Component
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
            <div className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <span>{change >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(change)}%</span>
              <span className="text-surface-400 dark:text-surface-500">vs semana anterior</span>
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
              ? 'bg-kiwi-500 text-white shadow-md'
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
