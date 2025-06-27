import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path' // You need to import the 'path' module

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    chunkSizeWarningLimit: 3000,
  },
  server: {
    host: true,
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
    include: ['@signalwire/js'],
    force: true
  },
  // This section fixes SignalWire WebSocket issues
  resolve: {
    alias: {
      'ws': 'isomorphic-ws' // Use browser-friendly WebSocket polyfill
    }
  },
  define: {
    global: 'globalThis',
  }
})
