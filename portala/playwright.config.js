// Playwright is used here as a fast Node test runner for data generation checks.
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: "./tests",
  timeout: 30_000,
  reporter: "list",
};

module.exports = config;
