import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    build: {
      manifest: 'asset-manifest.json',
      rollupOptions: {
        input: {
          app: 'index.html',
          'service-worker': 'src/sw.ts',
        },
        output: {
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === 'service-worker'
              ? 'sw.js'
              : 'assets/[name]-[hash].js',
        },
      },
    },
    plugins: [react(), tailwindcss()],
  };
});
