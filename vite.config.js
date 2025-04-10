import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    cors: true,
    strictPort: true,
    hmr: {
      clientPort: 3000
    }
  }
}); 