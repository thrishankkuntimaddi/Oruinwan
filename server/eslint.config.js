// eslint.config.js - ESLint v9 Flat Config
// Migration from .eslintrc.json

export default [
    {
        // Global ignores
        ignores: [
            'node_modules/**',
            'uploads/**',
            'build/**',
            'dist/**',
            '*.min.js'
        ]
    },
    {
        // Base configuration for all JS files
        files: ['**/*.js'],
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
            // Warn on console usage (except warn/error)
            'no-console': ['warn', {
                allow: ['warn', 'error']
            }],

            // Warn on unused variables (ignore those starting with _)
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
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
