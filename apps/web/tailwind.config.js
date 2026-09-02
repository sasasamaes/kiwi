/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // 🥝 KIWI BRAND COLORS
      colors: {
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
          DEFAULT: '#22c55e',
        },
        bark: {
          50: '#faf8f5',
          100: '#f5f0e8',
          200: '#ebe0d0',
          300: '#dcc9ad',
          400: '#c9a87c',
          500: '#b8915a',
          600: '#a67d4a',
          700: '#8b653d',
          800: '#725236',
          900: '#5e442e',
          DEFAULT: '#8b653d',
        },
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
          DEFAULT: '#fbbf24',
        },
        surface: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
        primary: {
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
        secondary: {
          50: '#faf8f5',
          100: '#f5f0e8',
          200: '#ebe0d0',
          300: '#dcc9ad',
          400: '#c9a87c',
          500: '#b8915a',
          600: '#a67d4a',
          700: '#8b653d',
          800: '#725236',
          900: '#5e442e',
        },
        accent: {
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

      // 🌈 GRADIENTS
      backgroundImage: {
        'kiwi-gradient': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'kiwi-vibrant': 'linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
        'kiwi-sunset': 'linear-gradient(135deg, #22c55e 0%, #fbbf24 100%)',
        'kiwi-mesh': 'radial-gradient(at 40% 20%, rgba(34,197,94,0.2) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(22,163,74,0.2) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(74,222,128,0.2) 0px, transparent 50%)',
        'glass-white': 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
        'glass-green': 'linear-gradient(135deg, rgba(34,197,94,0.9) 0%, rgba(22,163,74,0.9) 100%)',
        'bg-light': 'linear-gradient(135deg, #f0fdf4 0%, #fafaf9 50%, #f5f5f4 100%)',
      },

      // 📐 BORDER RADIUS
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },

      // 🌑 SHADOWS
      boxShadow: {
        'kiwi': '0 8px 24px -4px rgba(34, 197, 94, 0.35)',
        'kiwi-lg': '0 16px 40px -8px rgba(34, 197, 94, 0.4)',
        'kiwi-xl': '0 24px 60px -12px rgba(34, 197, 94, 0.5)',
        'gold': '0 8px 24px -4px rgba(251, 191, 36, 0.35)',
        'bark': '0 8px 24px -4px rgba(139, 101, 61, 0.25)',
        'soft': '0 2px 8px 0 rgb(0 0 0 / 0.04)',
        'soft-md': '0 4px 12px 0 rgb(0 0 0 / 0.06)',
        'soft-lg': '0 8px 24px 0 rgb(0 0 0 / 0.08)',
        'soft-xl': '0 16px 48px 0 rgb(0 0 0 / 0.1)',
        'inner-soft': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.04)',
      },

      // 🖋️ TYPOGRAPHY
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      // ⏱️ ANIMATIONS
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'fade-in-down': 'fadeInDown 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'pop': 'pop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },

      // 🎯 BACKDROP BLUR
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
        '3xl': '64px',
      },
    },
  },
  plugins: [],
};
