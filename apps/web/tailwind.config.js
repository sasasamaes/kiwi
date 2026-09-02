/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Kiwi Green Palette
        kiwi: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Bark Brown Palette
        bark: {
          50: '#fdf8f3',
          100: '#f5e6d3',
          200: '#e8cba3',
          300: '#d4a574',
          400: '#c08850',
          500: '#a67332',
          600: '#8b5a2b',
          700: '#6d4521',
          800: '#4f3218',
          900: '#36220f',
        },
        // Gold Palette
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
        // Surface Colors (with dark mode)
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
      },
      backgroundImage: {
        'kiwi-gradient': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'kiwi-gradient-dark': 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
        'surface-gradient': 'linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)',
        'surface-gradient-dark': 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
      },
      boxShadow: {
        'kiwi': '0 4px 14px 0 rgba(34, 197, 94, 0.25)',
        'kiwi-lg': '0 10px 40px -10px rgba(34, 197, 94, 0.35)',
        'kiwi-xl': '0 20px 60px -15px rgba(34, 197, 94, 0.4)',
        'soft': '0 2px 8px 0 rgb(0 0 0 / 0.04)',
        'soft-md': '0 4px 16px 0 rgb(0 0 0 / 0.06)',
        'soft-lg': '0 8px 32px 0 rgb(0 0 0 / 0.08)',
        'dark': '0 2px 8px 0 rgb(0 0 0 / 0.3)',
        'dark-lg': '0 8px 32px 0 rgb(0 0 0 / 0.4)',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'kiwi-bounce': 'kiwiBounce 2s infinite',
        'kiwi-pulse': 'kiwiPulse 2s infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        kiwiBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        kiwiPulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.7 },
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
}
