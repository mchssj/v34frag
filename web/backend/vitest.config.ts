import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'unit', include: ['test/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        // Requieren la Supabase local levantada (npm run db:start).
        test: { name: 'integration', include: ['test/integration/**/*.test.ts'], environment: 'node', testTimeout: 20_000 },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/db/types.ts', // generado por la CLI de Supabase: solo tipos
        'src/node.ts', // entradas: las cubre el humo (npm run smoke), no Vitest
        'src/worker.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // Mínimo acordado con Daniel (2026-10-14). npm run test:coverage falla por debajo.
      thresholds: { lines: 60, statements: 60, functions: 60, branches: 60 },
    },
  },
});
