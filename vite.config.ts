import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Listen on the network, and accept the Pi's mDNS name so other devices
  // can open http://raspberrypi.local:5173
  server: { host: true, allowedHosts: ['raspberrypi.local'] },
});
