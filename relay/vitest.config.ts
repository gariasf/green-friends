import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      // Stand-ins for the secrets; the tests mock Pl@ntNet itself.
      miniflare: { bindings: { PLANTNET_KEY: 'test-plantnet-key', APP_TOKEN: 'test-app-token' } },
    }),
  ],
});
