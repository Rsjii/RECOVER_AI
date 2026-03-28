import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'recharts': ['recharts'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'date-fns': ['date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
