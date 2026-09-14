/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks', '@kiwi'],
  // Reglas locales del repo (@kiwi/eslint-plugin) — un solo lugar para
  // políticas de seguridad transversales.
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    // Seguridad: sin asignaciones crudas de URLs dinámicas a location.
    // Usar safeNavigateToUrl() de @kiwi/ui (ver packages/eslint-plugin-kiwi/).
    '@kiwi/no-raw-location-assign': 'error',
  },
  ignorePatterns: ['node_modules/', 'dist/', '.next/', 'build/'],
};
