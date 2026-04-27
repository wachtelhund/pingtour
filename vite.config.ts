import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow LAN IPs and tunnels (ngrok, cloudflared, …) to access the dev
    // server. Vite blocks unknown hosts by default as DNS-rebinding
    // protection, but in dev that's just friction.
    allowedHosts: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3939',
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
