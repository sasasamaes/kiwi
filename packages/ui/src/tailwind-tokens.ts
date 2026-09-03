/**
 *  KIWI TAILWIND DESIGN TOKENS
 *
 * Tropical Pura Vida Night — Semantic design system for Stitch integration.
 * Import this in each app's tailwind.config.js:
 *
 *   const { kiwiDesignTokens } = require('@kiwi/ui/tailwind-tokens');
 *   module.exports = { ...kiwiDesignTokens, content: [...] }
 */

export const kiwiDesignTokens = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ─── Primary Accent ───
        kiwi: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e', // Kiwi Leaf — brand signature
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          DEFAULT: '#22c55e',
        },

        // ─── Secondary Accents ───
        lime: '#4ade80', // Lime Pulse — hover, focus, secondary badges
        emerald: '#10b981', // Deep Emerald — success, data viz
        amber: '#f59e0b', // Sunburst Amber — ratings, urgency, express
        sinpe: '#0284c7', // SINPE Blue — Costa Rica payment accent

        // ─── Dark Mode Canvas (Midnight) ───
        canvas: {
          DEFAULT: '#0b1326', // Midnight Canvas — never pure black
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#0b1326',
        },

        // ─── Surface Colors (light mode) ───
        surface: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },

        // ─── Gold Palette (ratings, promos) ───
        gold: {
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
        },
      },

      fontFamily: {
        display: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },

      backgroundImage: {
        'kiwi-gradient': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'kiwi-gradient-dark': 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
        'surface-gradient': 'linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)',
        'surface-gradient-dark': 'linear-gradient(180deg, #0b1326 0%, #0f172a 100%)',
      },

      boxShadow: {
        kiwi: '0 4px 14px 0 rgba(34, 197, 94, 0.25)',
        'kiwi-lg': '0 10px 40px -10px rgba(34, 197, 94, 0.35)',
        'kiwi-xl': '0 20px 60px -15px rgba(34, 197, 94, 0.4)',
        'kiwi-glow': '0 0 20px -2px rgba(34, 197, 94, 0.35)',
        'kiwi-glow-lg': '0 8px 20px -4px rgba(34, 197, 94, 0.4)',
        glass: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        'glass-lg': '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        soft: '0 2px 8px 0 rgb(0 0 0 / 0.04)',
        'soft-md': '0 4px 16px 0 rgb(0 0 0 / 0.06)',
        'soft-lg': '0 8px 32px 0 rgb(0 0 0 / 0.08)',
        dark: '0 2px 8px 0 rgb(0 0 0 / 0.3)',
        'dark-lg': '0 8px 32px 0 rgb(0 0 0 / 0.4)',
      },

      animation: {
        'kiwi-bounce': 'kiwiBounce 2s infinite',
        'kiwi-pulse': 'kiwiPulse 2s infinite',
        float: 'float 3s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        shimmer: 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
      },

      keyframes: {
        kiwiBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        kiwiPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(34, 197, 94, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
