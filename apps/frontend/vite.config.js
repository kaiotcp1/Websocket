import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind compiles CSS during the build; it adds no runtime service.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bind to every network interface so another device on the same LAN can open
  // the development server with this computer's private IPv4 address.
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
});
