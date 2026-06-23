/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-refresh'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-empty': 'off',
    'no-extra-boolean-cast': 'off',
    'no-extra-semi': 'off',
    'prefer-const': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react-refresh/only-export-components': 'off',
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'Lavoro',
    '.claude',
    'supabase/functions',
    '*.config.js',
    '*.config.ts',
    '*.mjs',
    'tests/**',
    'e2e/**',
    '**/__tests__/**',
    'agenti-locali/**',
    // Console super-admin: sotto-progetto isolato con il proprio ESLint.
    'console/**',
  ],
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      excludedFiles: [
        'src/lib/logger.ts',
        'src/main.tsx',
        'src/lib/devConsole.ts',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
      ],
      rules: {
        // FU-LOG-1: app code uses logger.* — not console.log/debug/info
        'no-console': ['error', { allow: ['warn', 'error'] }],
      },
    },
    {
      files: [
        'src/lib/logger.ts',
        'src/main.tsx',
        'src/lib/devConsole.ts',
      ],
      rules: {
        // FU-LOG-1 allowlist — implementation / DevTools strip / dev health banner
        'no-console': 'off',
      },
    },
  ],
}
