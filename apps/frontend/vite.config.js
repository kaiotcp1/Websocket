import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind compiles CSS during the build; it adds no runtime service.
export default defineConfig({ plugins: [react(), tailwindcss()] });
