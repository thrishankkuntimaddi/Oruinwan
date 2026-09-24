// Shared Vitest setup. Runs before every test file.
import '@testing-library/jest-dom/vitest';

// Vite-style env defaults so modules that read import.meta.env work under test.
if (!import.meta.env.VITE_API_URL) import.meta.env.VITE_API_URL = 'http://localhost:8080/api';
