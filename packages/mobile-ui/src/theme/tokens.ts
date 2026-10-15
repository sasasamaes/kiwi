export const tokens = {
  color: {
    canvas: '#0b1326',
    surface: 'rgba(30,41,59,0.75)',
    border: 'rgba(51,65,85,0.6)',
    ink: '#f8fafc',
    muted: '#94a3b8',
    kiwi: '#22c55e',
    lime: '#4ade80',
    emerald: '#10b981',
    amber: '#f59e0b',
    sinpe: '#0284c7',
    danger: '#ffb4ab',
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 24 },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
} as const;
export type Tokens = typeof tokens;
