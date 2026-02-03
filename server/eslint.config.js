// eslint.config.js - ESLint v9 Flat Config
// Pre-deployment hardening: Lint ONLY modern architecture (src/**)

export default [
    {
        // Global ignores - exclude legacy and non-runtime files
        ignores: [
            // Dependencies and build artifacts
            'node_modules/**',
            'uploads/**',
            'build/**',
            'dist/**',
            '*.min.js',

            // Legacy root files (behavior-preserving - kept as fallback)
            'server.js',
            'socket.js',

            // Utility and migration scripts
            'scripts/**',
            'migrations/**',
            'fix-*.js',
            'init*.js',
            'clear*.js',
            '*.sh',

            // Legacy architecture (pre-src/ refactor)
            'config/**',
            'constants/**',
            'middleware/**',
            'models/**',
            'routes/**',
            'socket/**',
            'utils/**'
        ]
    },
    {
        // Lint ONLY modern architecture
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: {
                // Node.js globals
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'writable',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly'
            }
        },
        rules: {
            // Allow all console methods in server (logging is essential)
            'no-console': 'off',

            // Warn on unused variables (ignore those starting with _)
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],

            // Prevent legacy controller imports
            'no-restricted-imports': ['error', {
                patterns: [{
                    group: [
                        '../controllers/*',
                        '../../controllers/*',
                        '**/controllers/*'
                    ],
                    message: '🚫 LEGACY IMPORT: Use modules/ instead of controllers/. Import from src/modules/{domain}/'
                }]
            }]
        }
    }
];
