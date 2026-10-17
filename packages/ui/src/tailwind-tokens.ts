// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
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
        // Reglas de uso por contraste (WCAG AA):
        //  - Texto blanco encima: solo kiwi-700/800/900 (4.8–5.9:1) y el
        //    gradiente kiwi (700→800).
        //  - Texto kiwi sobre blanco/light: solo kiwi-700 (4.81:1) o más.
        //    kiwi-600 (3.3) reservado a texto ≥18.66px bold / iconos grandes.
        //  - kiwi-500: acentos, bordes, fondos sin texto — nunca texto encima.
        // Escala primaria "Azul Zona" (océano de Nicoya). Se mantiene el
        // nombre `kiwi` para no reescribir miles de clases existentes; usar
        // `zona` en código nuevo.
        //  - Texto blanco encima: 600+ (700 = 7.3:1).
        //  - Texto azul sobre claro: 700 o más oscuro.
        //  - 500: acentos, bordes, fondos sin texto.
        kiwi: {
          50: '#eef7fb',
          100: '#d6ecf5',
          200: '#aed9ea',
          300: '#7cc0da',
          400: '#4aa3c6',
          500: '#2a86ad', // Océano Nicoya — acento
          600: '#1f6d8f',
          700: '#195a77', // mínimo AA para texto sobre claro
          800: '#134a62',
          900: '#0d3345',
          DEFAULT: '#2a86ad',
        },
        zona: {
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
          DEFAULT: '#195a77',
        },

        // ─── Arena (fondo cálido, Guanacaste) ───
        arena: {
          50: '#fbf8f2',
          100: '#f5efe2',
          200: '#eadfc8',
          300: '#d9c9a6',
        },

        // Verde kiwi: acento secundario (éxito, frescura), uso puntual.
        leaf: {
          500: '#22c55e',
          700: '#15803d',
        },

        // ─── Secondary Accents ───
        lime: '#4ade80', // Lime Pulse — hover, focus, secondary badges (verde kiwi)
        emerald: '#10b981', // Deep Emerald — success, data viz
        amber: '#f59e0b', // Sunburst Amber — ratings, urgency, express
        sinpe: '#0284c7', // SINPE Blue — Costa Rica payment accent
        sol: '#e9a23b', // Sol de Guanacaste — destacados cálidos

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
        // En LIGHT el texto mínimo AA es surface-500 (4.63:1 sobre 50/white);
        // surface-400 (2.46) solo para decoración/icons grandes, nunca texto
        // informativo. En DARK los roles se invierten: texto mínimo AA sobre
        // 900/950 es surface-400 (6.6–7.2:1); 500+ (≤3.8) solo decorativo.
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
          900: '#101C33',
          950: '#0A1428',
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
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },

      backgroundImage: {
        // CTAs con texto blanco: el gradiente vive en el rango 700→800 porque
        // white/kiwi-600 solo llega a 3.3:1 (falla AA para texto <18pt) y
        // white/kiwi-700 = 4.81:1 ✓. kiwi-500 queda para acentos sin texto.
        'kiwi-gradient': 'linear-gradient(135deg, #195a77 0%, #0d3345 100%)',
        'kiwi-gradient-dark': 'linear-gradient(135deg, #134a62 0%, #0d3345 100%)',
        'zona-wave':
          'radial-gradient(120% 80% at 0% 0%, rgba(124,192,218,0.35) 0%, rgba(124,192,218,0) 60%), radial-gradient(90% 70% at 100% 100%, rgba(233,162,59,0.22) 0%, rgba(233,162,59,0) 60%)',
        'surface-gradient': 'linear-gradient(180deg, #fbf8f2 0%, #f5efe2 100%)',
        'surface-gradient-dark': 'linear-gradient(180deg, #0b1326 0%, #0f172a 100%)',
      },

      boxShadow: {
        kiwi: '0 4px 14px 0 rgba(25, 90, 119, 0.22)',
        'kiwi-lg': '0 10px 40px -10px rgba(25, 90, 119, 0.3)',
        'kiwi-xl': '0 20px 60px -15px rgba(25, 90, 119, 0.35)',
        'kiwi-glow': '0 0 20px -2px rgba(42, 134, 173, 0.35)',
        'kiwi-glow-lg': '0 8px 20px -4px rgba(42, 134, 173, 0.4)',
        card: '0 1px 2px rgb(13 51 69 / 0.04), 0 8px 24px -12px rgb(13 51 69 / 0.12)',
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
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fadeIn 0.5s ease-out both',
        'wave-drift': 'waveDrift 14s ease-in-out infinite alternate',
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
          '0%': { boxShadow: '0 0 5px rgba(42, 134, 173, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(42, 134, 173, 0.4)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        waveDrift: {
          '0%': { transform: 'translate3d(-2%, 0, 0) scale(1)' },
          '100%': { transform: 'translate3d(2%, -2%, 0) scale(1.04)' },
        },
      },
    },
  },
  plugins: [],
};
