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
        // 홈 화면 설치 시 세로 고정 — Android 는 잠기고, iOS 는 매니페스트를 무시한다
        // (일반 브라우저 탭에선 웹이 회전을 막을 방법이 없음 · iOS 는 추후 네이티브 래핑 시 잠금)
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/logo_pullit_favicon.png',
            sizes: '200x200',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // 로컬 개발 포트 고정 (dev 서버 전용 — 프로덕션 빌드/nginx 배포에는 영향 없음)
    port: 3000,
    // 같은 와이파이의 폰·태블릿에서 맥 IP(http://172.16.x.x:3000)로 접속 허용
    host: true,
  },
  preview: {
    port: 3000,
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
