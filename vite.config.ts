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
    modules: {
      // CSS Modules 클래스명에 파일명 포함 (네이버 방식) · dev/prod 동일
      // 예: TasteQuizPage-module__problemCard___aB3xK
      // 운영 디버깅 시 클래스명만 보고 소속 파일 즉시 식별 · gzip 압축으로 용량 손해 없음
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
    preprocessorOptions: {
      scss: {
        // Sass 에서 src 기반 절대 경로 import 가능하게 · 사용 예: @use 'styles/tokens' as *;
        loadPaths: [path.resolve(__dirname, './src')],
      },
    },
  },
})
