const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  globalIgnores([
    'dist/*',
    'drizzle/*',
    'ios/*',
    'android/*',
    '.expo/*',
    'expo-env.d.ts',
    'relay/worker-configuration.d.ts',
  ]),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    // src/core is plain TypeScript: domain logic must stay portable to a future web client (ADR-0001).
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'react-native/*',
                'expo',
                'expo/*',
                'expo-*',
                '@expo/*',
                '**/db/client',
              ],
              message:
                'src/core must not import React, React Native, Expo, or the app database client (ADR-0001).',
            },
          ],
        },
      ],
    },
  },
  {
    // The relay's `cloudflare:*` modules exist only inside the Workers runtime.
    files: ['relay/**/*.ts'],
    rules: { 'import/no-unresolved': ['error', { ignore: ['^cloudflare:'] }] },
  },
]);
