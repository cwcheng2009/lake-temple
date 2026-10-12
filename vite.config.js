import { defineConfig } from 'vite';

// base './' makes the built site work from any GitHub Pages path (username.github.io/repo-name/)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
