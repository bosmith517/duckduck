import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    port: 5173
  },
  // Essential for SCSS imports (your app uses Bootstrap/Metronic SCSS)
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: [path.resolve(__dirname, 'node_modules')],
      },
    },
  },
  // Prevent duplicate React instances
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Redirect realtime-api to browser-compatible js package
      '@signalwire/realtime-api': '@signalwire/js'
    }
  },
  // Required for some packages that expect 'global' to exist
  define: {
    global: 'globalThis',
  },
  // Polyfill Node.js globals
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
})
