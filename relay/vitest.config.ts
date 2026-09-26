import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      // A stand-in for the PLANTNET_KEY secret; the tests mock Pl@ntNet itself.
      miniflare: { bindings: { PLANTNET_KEY: 'test-plantnet-key' } },
    }),
  ],
});
