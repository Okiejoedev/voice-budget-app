import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // '/' on Vercel or localhost; '/voice-budget-app/' on GitHub Pages (set by the deploy workflow)
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
})
