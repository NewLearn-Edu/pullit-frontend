/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // hover: 유틸리티를 마우스가 있는 기기에만 적용 (iPad · 모바일 sticky hover 방지)
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF385C',
          hover: '#E6203F',
        },
        foreground: '#120C0B',
        body: '#6F6A68',
        muted: '#A59F9D',
        canvas: '#FFFFFF',
        surface: '#F6F4F2',
        line: '#E8E4E2',
        weak: {
          bg: '#FFF0F2',
          fg: '#FF385C',
        },
        danger: '#BF1A34',
        success: '#2DD4A0',
        dark: {
          bg: '#160F0E',
          bg2: '#1B1412',
          bg3: '#120C0B',
          glass: '#211A18',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'Apple SD Gothic Neo',
          'sans-serif',
        ],
        // KoPubWorld 명조체 · 문제/해설 본문 (교과서·시험지 톤)
        batang: [
          'KoPubWorld Batang',
          'Apple SD Gothic Neo',
          'Nanum Myeongjo',
          'serif',
        ],
        // KoPubWorld 고딕체 (필요 시)
        dotum: [
          'KoPubWorld Dotum',
          'Apple SD Gothic Neo',
          'sans-serif',
        ],
      },
      fontSize: {
        h1: ['36px', { lineHeight: '54px', fontWeight: '700' }],
        h2: ['30px', { lineHeight: '45px', fontWeight: '600' }],
        h3: ['24px', { lineHeight: '36px', fontWeight: '600' }],
        h4: ['22px', { lineHeight: '33px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '21px' }],
      },
      spacing: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '16px',
        xl: '24px',
        xxl: '32px',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        'btn-sm': '8px',
        'btn-md': '10px',
        'btn-lg': '14px',
        'btn-xl': '16px',
        marketing: '7px',
      },
      maxWidth: {
        inner: '1180px',
      },
    },
  },
  plugins: [],
}
