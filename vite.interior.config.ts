import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Interior Studio standalone build config.
// root='.' outputs to interior-studio/dist/
// index.html lands at interior-studio/dist/interior-studio/index.html
// agent_runtime.py mounts interior-studio/dist/ at /interior-studio/
// so the page is accessible at /interior-studio/interior-studio/ (redirect handled by html:true)
// Simpler: mount interior-studio/dist/interior-studio at /interior-studio/
export default defineConfig({
  base: '/interior-studio/',
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'interior-studio/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'interior-studio/index.html'),
      }
    }
  }
});
