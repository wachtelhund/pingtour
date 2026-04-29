import { defineFunction } from '@aws-amplify/backend';

/**
 * The single Lambda that backs `/api/state` and `/api/mutate`.
 * Bundled by esbuild; imports the existing pure logic from `src/`.
 */
export const apiFunction = defineFunction({
  name: 'pingtour-api',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
  runtime: 22,
  environment: {
    ADMIN_PASSWORD: 'pingpong123',
  },
});
