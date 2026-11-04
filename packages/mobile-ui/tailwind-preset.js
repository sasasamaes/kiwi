// Harmoniza con packages/ui/src/tailwind-tokens.ts (fuente web).
// Clases PWA como bg-kiwi-700, dark:bg-surface-800 o text-gold-600
// funcionan igual en las apps Expo que usen este preset.
const kiwi = {
  50: '#eef7fb',
  100: '#d6ecf5',
  200: '#aed9ea',
  300: '#7cc0da',
  400: '#4aa3c6',
  500: '#2a86ad',
  600: '#1f6d8f',
  700: '#195a77',
  800: '#134a62',
  900: '#0d3345',
  DEFAULT: '#2a86ad',
};

const surface = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#101C33',
  950: '#0A1428',
};

const gold = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
};

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kiwi,
        zona: { ...kiwi, DEFAULT: '#195a77' },
        surface,
        gold,
        canvas: '#0b1326',
        arena: { 50: '#fbf8f2', 100: '#f5efe2', 200: '#eadfc8', 300: '#d9c9a6' },
        leaf: { 500: '#22c55e', 700: '#15803d' },
        lime: '#4ade80',
        emerald: '#10b981',
        amber: '#f59e0b',
        sinpe: '#0284c7',
        sol: '#e9a23b',
        danger: '#ef4444',
        ink: '#f8fafc',
        muted: '#94a3b8',
        line: 'rgba(51,65,85,0.6)',
      },
    },
  },
};
