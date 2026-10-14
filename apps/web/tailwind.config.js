// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/** @type {import('tailwindcss').Config} */
const { kiwiDesignTokens } = require('../../packages/ui/src/tailwind-tokens');

module.exports = {
  ...kiwiDesignTokens,
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};
