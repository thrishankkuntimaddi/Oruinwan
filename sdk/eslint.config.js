export default [
  { ignores: ['node_modules/**', 'eslint.config.js'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        module: 'writable', define: 'readonly', self: 'readonly', window: 'readonly', globalThis: 'readonly',
        fetch: 'readonly', AbortController: 'readonly', FormData: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        console: 'readonly', require: 'readonly', Promise: 'readonly',
        describe: 'readonly', test: 'readonly', expect: 'readonly', jest: 'readonly',
      },
    },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], 'no-undef': 'error' },
  },
];
