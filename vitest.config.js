import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    // Dummy values so src/db/supabase.js's createClient() call doesn't throw
    // on import — no test should ever hit the real network, they mock
    // supabase methods explicitly, but the client object still has to
    // construct successfully to be mockable.
    env: {
      PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      PUBLIC_SUPABASE_KEY: 'test-anon-key',
    },
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/i18n/**', 'src/scripts/**', 'src/db/**'],
      exclude: ['**/*.test.js'],
    },
  },
});
