/**
 * 🥝 KIWI PREMIUM DESIGN SYSTEM
 *
 * Modern, trendy, and beautiful UI/UX
 * Based on 2026 design trends:
 * - Glassmorphism
 * - Neumorphism
 * - Gradient meshes
 * - Micro-interactions
 * - Organic shapes
 */

export const kiwiPremiumTheme = {
  // ============================================
  // 🎨 BRAND COLORS
  // ============================================
  colors: {
    // Primary - Fresh Kiwi Green
    kiwi: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e', // Vibrant Green
      600: '#16a34a', // Deep Green
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      DEFAULT: '#22c55e',
    },

    // Secondary - Warm Bark Brown
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

    // Accent - Golden Sunshine
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

    // Neutral - Soft Grays
    stone: {
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
      DEFAULT: '#78716c',
    },

    // Semantic Colors
    success: {
      light: '#dcfce7',
      DEFAULT: '#22c55e',
      dark: '#15803d',
    },
    warning: {
      light: '#fef3c7',
      DEFAULT: '#f59e0b',
      dark: '#b45309',
    },
    danger: {
      light: '#fee2e2',
      DEFAULT: '#ef4444',
      dark: '#dc2626',
    },
    info: {
      light: '#dbeafe',
      DEFAULT: '#3b82f6',
      dark: '#2563eb',
    },
  },

  // ============================================
  // 🌈 GRADIENTS
  // ============================================
  gradients: {
    // Primary gradients
    kiwi: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    kiwiVibrant: 'linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
    kiwiSunset: 'linear-gradient(135deg, #22c55e 0%, #fbbf24 100%)',

    // Mesh gradients (trending 2026)
    meshGreen:
      'radial-gradient(at 40% 20%, #22c55e33 0px, transparent 50%), radial-gradient(at 80% 0%, #16a34a33 0px, transparent 50%), radial-gradient(at 0% 50%, #4ade8033 0px, transparent 50%)',

    // Glass gradients
    glassWhite: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
    glassGreen: 'linear-gradient(135deg, rgba(34,197,94,0.9) 0%, rgba(22,163,74,0.9) 100%)',

    // Background gradients
    bgLight: 'linear-gradient(135deg, #f0fdf4 0%, #fafaf9 50%, #f5f5f4 100%)',
    bgDark: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
  },

  // ============================================
  // ✨ GLASS EFFECTS
  // ============================================
  glass: {
    // Light glass
    light: {
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
    },
    // Green glass
    green: {
      background: 'rgba(34, 197, 94, 0.15)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
    },
    // Dark glass
    dark: {
      background: 'rgba(28, 25, 23, 0.8)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
  },

  // ============================================
  // 📏 SPACING & SIZING
  // ============================================
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
  },

  // ============================================
  // 📐 BORDER RADIUS (Organic shapes)
  // ============================================
  borderRadius: {
    none: '0',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px',
    full: '9999px',
    // Organic shapes
    blob: '30% 70% 70% 30% / 30% 30% 70% 70%',
    organic: '60% 40% 30% 70% / 60% 30% 70% 40%',
  },

  // ============================================
  // 🌑 SHADOWS (Soft & Diffused)
  // ============================================
  shadows: {
    // Soft shadows (modern)
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.03)',
    sm: '0 2px 4px 0 rgb(0 0 0 / 0.04)',
    md: '0 4px 8px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
    lg: '0 8px 16px -2px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.08)',
    xl: '0 16px 32px -4px rgb(0 0 0 / 0.1), 0 8px 16px -8px rgb(0 0 0 / 0.1)',
    '2xl': '0 24px 48px -8px rgb(0 0 0 / 0.12)',

    // Colored shadows
    kiwi: '0 8px 24px -4px rgba(34, 197, 94, 0.35)',
    'kiwi-lg': '0 16px 40px -8px rgba(34, 197, 94, 0.4)',
    gold: '0 8px 24px -4px rgba(251, 191, 36, 0.35)',
    bark: '0 8px 24px -4px rgba(139, 101, 61, 0.25)',

    // Inner shadows (neumorphism)
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    'inner-lg': 'inset 0 4px 8px 0 rgb(0 0 0 / 0.08)',
  },

  // ============================================
  // 🖋️ TYPOGRAPHY
  // ============================================
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    display: ['Plus Jakarta Sans', 'Poppins', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  },

  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
    sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
    base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
    lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
    xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
    '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
    '5xl': ['3rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
    '6xl': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
  },

  // ============================================
  // ⏱️ ANIMATIONS
  // ============================================
  animation: {
    // Micro-interactions
    'fade-in': 'fadeIn 0.3s ease-out',
    'fade-in-up': 'fadeInUp 0.4s ease-out',
    'fade-in-down': 'fadeInDown 0.4s ease-out',
    'slide-in-right': 'slideInRight 0.3s ease-out',
    'slide-in-left': 'slideInLeft 0.3s ease-out',

    // Bouncy (fun)
    'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    pop: 'pop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',

    // Continuous
    'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
    float: 'float 3s ease-in-out infinite',
    wiggle: 'wiggle 1s ease-in-out infinite',

    // Loading
    'spin-slow': 'spin 3s linear infinite',
    'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
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
};

export default kiwiPremiumTheme;
