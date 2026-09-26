import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'vite.config.js',
            'postcss.config.js',
            'tailwind.config.js'
        ]
    },
    {
        files: ['src/**/*.js', 'src/**/*.jsx'],
        plugins: {
            react,
            'react-hooks': reactHooks
        },
        settings: {
            react: { version: 'detect' }
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {
                    jsx: true
                }
            },
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                fetch: 'readonly',
                process: 'readonly',
                import: 'readonly'
            }
        },
        rules: {
            // Without these two, every component used only in JSX is reported as unused.
            'react/jsx-uses-vars': 'error',
            'react/jsx-uses-react': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^(_|React$)', caughtErrors: 'none' }],
            'no-console': 'off'
        }
    }
];
