const sharedPreset = require('../../packages/mobile-ui/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset'), sharedPreset],
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/mobile-ui/src/**/*.{ts,tsx}',
  ],
};
