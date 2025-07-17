import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // You need to import the 'path' module

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    chunkSizeWarningLimit: 3000,
    // Add content hash to filenames for cache busting
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    },
    // Generate manifest for cache management
    manifest: true,
    // Improve build performance
    sourcemap: false,
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: false,
    hmr: {
      overlay: false
    }
  },
  // This section tells Vite's Sass compiler where to look for imported files.
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: [path.resolve(__dirname, 'node_modules')],
      },
    },
  },
  // Handle SignalWire package optimization
  optimizeDeps: {
    include: ['@signalwire/js', 'react', 'react-dom', 'react/jsx-runtime', 'react-router-dom'],
    exclude: ['@vite/client', '@vite/env']
  },
  // This section fixes SignalWire WebSocket issues
  resolve: {
    alias: {
      'ws': 'isomorphic-ws', // Use browser-friendly WebSocket polyfill
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
    },
    dedupe: ['react', 'react-dom']
  },
  define: {
    global: 'globalThis',
  }
})
