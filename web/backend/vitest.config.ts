import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'unit', include: ['test/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        // Requieren la Supabase local levantada (pnpm db:start).
        // Un archivo a la vez: varios tocan estado global de la base (configuración y recálculo del ELO,
        // tope de SteamID) y en paralelo se pisan.
        test: { name: 'integration', include: ['test/integration/**/*.test.ts'], environment: 'node', testTimeout: 20_000, fileParallelism: false },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/db/types.ts', // generado por la CLI de Supabase: solo tipos
        'src/node.ts', // entradas: las cubre el humo (pnpm smoke), no Vitest
        'src/worker.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // Mínimo acordado con Daniel (2026-10-14). pnpm test:coverage falla por debajo.
      thresholds: { lines: 60, statements: 60, functions: 60, branches: 60 },
    },
  },
});
