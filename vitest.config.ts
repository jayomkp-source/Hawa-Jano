import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/utils/**/*.ts',
        'src/services/**/*.ts',
        'src/data/indoorAirData.ts',
        'src/components/**/*.tsx',
        'src/pages/**/*.tsx',
        'server/createApp.ts',
      ],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
});
