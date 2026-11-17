import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '127.0.0.1',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('react-router-dom') || id.includes('react-router')) return 'router-vendor';
                if (id.includes('react-dom') || id.includes('react')) return 'react-vendor';
                if (id.includes('lucide-react')) return 'icons';
                if (id.includes('axios')) return 'network';
                if (id.includes('@google/generative-ai')) return 'ai-vendor';
                return 'vendor';
              }
            }
          }
        }
      }
    };
});
