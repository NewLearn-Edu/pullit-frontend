import { clsx } from 'clsx'
import { useLocation, useNavigate } from 'react-router-dom'
import { readNavTab, rememberNavTab } from '@/user/utils/lastNavTab'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import styles from './styles/WrongNoteBadge.module.scss'

/**
 * 모바일 헤더 "오답" 배지 (Figma 3368-8857 기본 · 2856-19940 활성, 2026-09-06)
 * 크레딧 배지와 같은 필 규격(72×33 · r42)에 빨간 북마크 18px + "오답" 14 Bold.
 * - 기본: 흰 필 · 검정 글자 — 누르면 오답노트로 (들어오기 직전 탭을 기억해 둔다)
 * - active: 검정 필 · 흰 글자 — 오답노트 페이지 자신. 다시 누르면 "닫기" 처럼 직전 하단 네비 탭으로
 *   돌아간다 (2026-09-06). 오답노트는 하단 네비에 자리가 없어 이 배지가 유일한 출입구다.
 *   웹(desktop)은 사이드바에 오답노트가 있어 이 배지 자체가 숨겨진다 (hideRightOnDesktop).
 * 예전엔 페이지마다 32px 원형 아이콘 버튼을 따로 그려 시안과 달랐다.
 */
export function WrongNoteBadge({
  active = false,
  elevated,
}: {
  active?: boolean
  /** 캔버스 위에 떠 있는 헤더(약점지도)용 그림자 — 흰 필이 배경에 묻히지 않게 (2026-09-06) */
  elevated?: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const content = (
    <>
      <span className={styles.icon}>
        <WrongNoteIcon size={18} filled />
      </span>
      오답
    </>
  )
  if (active) {
    return (
      <button
        type="button"
        aria-current="page"
        aria-label="오답노트 닫기"
        onClick={() => navigate(readNavTab())}
        className={clsx(styles.badge, styles.badgeActive, elevated && styles.badgeElevated)}
      >
        {content}
      </button>
    )
  }
  return (
    <button
      type="button"
      aria-label="오답노트"
      onClick={() => {
        rememberNavTab(location.pathname, location.search) // 돌아올 자리 — 배지를 다시 누르면 여기로
        navigate('/wrong-note')
      }}
      className={clsx(styles.badge, elevated && styles.badgeElevated)}
    >
      {content}
    </button>
  )
}
