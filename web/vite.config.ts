import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * drizzle/migrations.js imports each migration's SQL as a string, which babel's inline-import does
 * for the app; this does it here, as `?raw` would, for a file drizzle-kit generates.
 */
const sqlAsText: Plugin = {
  name: 'sql-as-text',
  transform(code, id) {
    if (id.endsWith('.sql')) return `export default ${JSON.stringify(code)};`;
  },
};

export default defineConfig({
  plugins: [react(), sqlAsText],
  // The Web view runs the app's own src/core, drizzle/ and assets/, one level up.
  server: {
    fs: { allow: ['..'] },
    // PROTOTYPE (prototype/web-design): the relay, same-origin for the dev server.
    proxy: {
      '/relay': {
        target: 'https://green-friends-relay.gariasf.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/relay/, ''),
      },
    },
  },
});
