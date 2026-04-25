export default [
    {
        
        ignores: [
            
            'node_modules/**',
            'uploads/**',
            'build/**',
            'dist/**',
            '*.min.js',

            
            'server.js',
            'socket.js',

            
            'scripts/**',
            'migrations/**',
            'fix-*.js',
            'init*.js',
            'clear*.js',
            '*.sh',

            
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
        
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: {
                
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
            
            'no-console': 'off',

            
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],

            
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
