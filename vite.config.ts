import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  root: 'web',
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve('shared'), '@': path.resolve('web/src') } },
  server: { proxy: { '/api': 'http://localhost:3000', '/ws': { target: 'ws://localhost:3000', ws: true } } },
  build: { outDir: '../dist', emptyOutDir: true },
});
