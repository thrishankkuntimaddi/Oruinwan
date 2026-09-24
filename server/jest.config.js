/** Jest configuration for the Chttrix server (CommonJS, Node). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/../ai', '<rootDir>/../sdk'],
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  testTimeout: 15000,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/**/__tests__/**', '!src/scripts/**'],
};
