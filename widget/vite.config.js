import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: 'src/index.jsx',
      output: {
        entryFileNames: 'widget.js',
        dir: 'dist',
        format: 'iife',
        name: 'ChatWidget'
      }
    },
    cssCodeSplit: false
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
})
