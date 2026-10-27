import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative base + hash routing means the build works on GitHub Pages
// under any repo name without server config.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
