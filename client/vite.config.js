import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const EXPRESS = process.env.VITE_API_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': EXPRESS,
      '/media': EXPRESS,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
});
