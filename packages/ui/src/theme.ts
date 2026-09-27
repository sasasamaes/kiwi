// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * 🥝 Kiwi Brand Theme
 *
 * Colores modernos y elegantes para la plataforma de repartidores
 */

export const kiwiTheme = {
  // ============================================
  // 🎨 COLORES PRINCIPALES
  // ============================================
  colors: {
    // Kiwi Green - Primario (Acciones principales, CTAs)
    primary: {
      50: '#f0fdf4', // Green 50
      100: '#dcfce7', // Green 100
      200: '#bbf7d0', // Green 200
      300: '#86efac', // Green 300
      400: '#4ade80', // Green 400
      500: '#6BB536', // Kiwi Green (Principal)
      600: '#5a9e2e', // Kiwi Green Dark
      700: '#4a8726', // Kiwi Green Darker
      800: '#3a6f1e', // Kiwi Green Very Dark
      900: '#2a5716', // Kiwi Green Darkest
    },

    // Kiwi Brown - Secundario (Textos, headers)
    secondary: {
      50: '#fdf8f3', // Brown 50
      100: '#f5e6d3', // Brown 100
      200: '#e8cba7', // Brown 200
      300: '#d4a574', // Brown 300
      400: '#c0854a', // Brown 400
      500: '#8B5A2B', // Kiwi Brown (Secundario)
      600: '#7a4f25', // Kiwi Brown Dark
      700: '#694420', // Kiwi Brown Darker
      800: '#58391a', // Kiwi Brown Very Dark
      900: '#472e14', // Kiwi Brown Darkest
    },

    // Kiwi Yellow - Acento (Alertas, highlights)
    accent: {
      50: '#fffef0', // Yellow 50
      100: '#fff9cc', // Yellow 100
      200: '#fff399', // Yellow 200
      300: '#ffed66', // Yellow 300
      400: '#ffe733', // Yellow 400
      500: '#FFD700', // Kiwi Yellow (Acento)
      600: '#e6c200', // Kiwi Yellow Dark
      700: '#b39700', // Kiwi Yellow Darker
      800: '#806c00', // Kiwi Yellow Very Dark
      900: '#4d4100', // Kiwi Yellow Darkest
    },

    // Neutros
    neutral: {
      50: '#FAFAFA', // Background
      100: '#F5F5F5', // Surface
      200: '#E5E5E5', // Border
      300: '#D4D4D4', // Border Light
      400: '#A3A3A3', // Text Muted
      500: '#737373', // Text Secondary
      600: '#525252', // Text Primary
      700: '#404040', // Text Dark
      800: '#262626', // Text Darker
      900: '#171717', // Text Darkest
    },

    // Estados
    success: '#22c55e', // Verde éxito
    warning: '#f59e0b', // Amarillo warning
    danger: '#ef4444', // Rojo error/peligro
    info: '#3b82f6', // Azul información
  },

  // ============================================
  // 📏 ESPACIADO
  // ============================================
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem', // 8px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
    '2xl': '3rem', // 48px
    '3xl': '4rem', // 64px
  },

  // ============================================
  // 📐 BORDER RADIUS
  // ============================================
  borderRadius: {
    none: '0',
    sm: '0.25rem', // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem', // 8px
    xl: '0.75rem', // 12px
    '2xl': '1rem', // 16px
    '3xl': '1.5rem', // 24px
    full: '9999px',
  },

  // ============================================
  // 🌑 SOMBRAS
  // ============================================
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },

  // ============================================
  // 🖋️ TIPOGRAFÍA
  // ============================================
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    display: ['Poppins', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },

  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  },
};

// ============================================
// 🏷️ EXPORTS
// ============================================
export const { colors, spacing, borderRadius, shadows, fontFamily, fontSize } = kiwiTheme;

export default kiwiTheme;
