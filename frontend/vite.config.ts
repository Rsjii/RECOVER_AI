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
    // Performance optimization
    minify: 'esbuild',
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'recharts': ['recharts'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'date-fns': ['date-fns'],
          'ui-components': [
            './src/components/ui/Button',
            './src/components/ui/Card',
            './src/components/ui/Modal',
            './src/components/ui/Input',
          ],
        },
      },
    },
    // Optimal chunk size
    chunkSizeWarningLimit: 600,
    // Source maps for production debugging
    sourcemap: false,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'recharts',
      'date-fns',
      'axios',
    ],
  },
});
