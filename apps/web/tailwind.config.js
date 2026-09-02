/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // 🥝 Kiwi Brand Colors
      colors: {
        // Primary - Kiwi Green
        kiwi: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#6BB536',  // Main Kiwi Green
          600: '#5a9e2e',
          700: '#4a8726',
          800: '#3a6f1e',
          900: '#2a5716',
        },
        // Secondary - Kiwi Brown
        bark: {
          50: '#fdf8f3',
          100: '#f5e6d3',
          200: '#e8cba7',
          300: '#d4a574',
          400: '#c0854a',
          500: '#8B5A2B',  // Main Kiwi Brown
          600: '#7a4f25',
          700: '#694420',
          800: '#58391a',
          900: '#472e14',
        },
        // Accent - Kiwi Yellow
        sunshine: {
          50: '#fffef0',
          100: '#fff9cc',
          200: '#fff399',
          300: '#ffed66',
          400: '#ffe733',
          500: '#FFD700',  // Main Kiwi Yellow
          600: '#e6c200',
          700: '#b39700',
          800: '#806c00',
          900: '#4d4100',
        },
        // Aliases
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#6BB536',
          600: '#5a9e2e',
          700: '#4a8726',
          800: '#3a6f1e',
          900: '#2a5716',
        },
        secondary: {
          50: '#fdf8f3',
          100: '#f5e6d3',
          200: '#e8cba7',
          300: '#d4a574',
          400: '#c0854a',
          500: '#8B5A2B',
          600: '#7a4f25',
          700: '#694420',
          800: '#58391a',
          900: '#472e14',
        },
        accent: {
          50: '#fffef0',
          100: '#fff9cc',
          200: '#fff399',
          300: '#ffed66',
          400: '#ffe733',
          500: '#FFD700',
          600: '#e6c200',
          700: '#b39700',
          800: '#806c00',
          900: '#4d4100',
        },
      },
      // 🎨 Kiwi Shadows
      boxShadow: {
        'kiwi': '0 4px 14px 0 rgba(107, 181, 54, 0.39)',
        'kiwi-lg': '0 10px 40px 0 rgba(107, 181, 54, 0.3)',
        'bark': '0 4px 14px 0 rgba(139, 90, 43, 0.25)',
      },
      // 🖋️ Kiwi Typography
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
