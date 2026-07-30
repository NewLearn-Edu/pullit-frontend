import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '풀잇 Pullit',
        short_name: '풀잇',
        description: '매일 4문제로 약점을 찾는 AI 학습 서비스',
        theme_color: '#FF385C',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Sass 에서 src 기반 절대 경로 import 가능하게 · 사용 예: @use 'styles/tokens' as *;
        loadPaths: [path.resolve(__dirname, './src')],
      },
    },
  },
})
