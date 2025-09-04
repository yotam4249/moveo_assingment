// @ts-nocheck
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    setupFiles: ["<rootDir>/tests/jest.setup.ts"],
    verbose: true
  };
  