// Vitest sets NODE_ENV=test, which makes config.js switch to the test DB & media dir. 
// Make sure when you make tests that you never test on the 'live' DB or files!
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.js'],
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
