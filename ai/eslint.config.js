export default [
  { ignores: ['node_modules/**', 'eslint.config.js'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly', __dirname: 'readonly', module: 'writable', require: 'readonly',
        console: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        fetch: 'readonly', AbortController: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
        describe: 'readonly', test: 'readonly', expect: 'readonly', jest: 'readonly', beforeEach: 'readonly', afterEach: 'readonly',
      },
    },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], 'no-undef': 'error' },
  },
];
