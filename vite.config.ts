import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Node's process.env, which this config reads (no @types/node needed for it)
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Where the site is served from. The GitHub Pages deploy sets BASE_PATH
  // to /penrogo/ (the site lives at <user>.github.io/penrogo/); everywhere
  // else it is the root.
  base: process.env.BASE_PATH || '/',
  // Listen on the network, and accept the Pi's mDNS name so other devices
  // can open http://raspberrypi.local:5173
  server: { host: true, allowedHosts: ['raspberrypi.local'] },
});
