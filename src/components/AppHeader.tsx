import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

interface AppHeaderProps {
  variant?: 'light' | 'dark'
  onClose?: () => void
  right?: React.ReactNode
}

/**
 * 앱 상단바 (라이트 테마 기본). 문제풀이 화면은 별도 QuizTopBar 사용.
 */
export default function AppHeader({ variant = 'light', onClose, right }: AppHeaderProps) {
  const isDark = variant === 'dark'
  return (
    <header
      className={clsx(
        'sticky top-0 z-20 border-b',
        isDark ? 'border-white/10 bg-dark-bg/80 backdrop-blur' : 'border-line bg-canvas/80 backdrop-blur',
      )}
    >
      <div className="inner flex h-14 items-center justify-between">
        <Link
          to="/"
          className={clsx('text-h4 font-bold', isDark ? 'text-primary' : 'text-primary')}
        >
          풀잇
        </Link>
        <div className="flex items-center gap-md">
          {right}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                'flex h-9 w-9 items-center justify-center rounded-full text-xl',
                isDark ? 'text-white/70 hover:bg-white/10' : 'text-body hover:bg-surface',
              )}
              aria-label="닫기"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
