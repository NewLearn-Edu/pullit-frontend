import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import styles from './styles/PageHeader.module.scss'

interface PageHeaderProps {
  /** 뒤로가기 버튼 — 이동할 경로, 또는 'history'(직전 화면, 히스토리 없으면 /home) */
  backTo?: string | 'history'
  /** 왼쪽 슬롯 (뒤로가기 버튼 오른쪽에 붙는다) */
  left?: ReactNode
  /** 가운데 슬롯 — 과목 토글 등 */
  center?: ReactNode
  /** 오른쪽 슬롯 — 크레딧·아이콘 버튼 등 */
  right?: ReactNode
  /**
   * 데스크탑(사이드바 구간)에서 right 슬롯이 사이드바와 중복 진입점일 때.
   * display:none 이면 space-between 균형이 깨져 center 가 밀리므로 자리만 유지하고 숨긴다.
   */
  hideRightOnDesktop?: boolean
  /**
   * backTo='history' 인데 뒤로 갈 히스토리가 없으면(첫 진입) 버튼을 숨긴다 — 홈 폴백이 의미 없는 화면(로그인 등).
   * 홈 화면에 추가한 웹앱(standalone)에서는 옵션과 무관하게 항상 이 규칙을 적용한다 (2026-09-04)
   */
  hideBackWhenNoHistory?: boolean
}

/** 홈 화면에 추가한 웹앱으로 실행 중인가 — 안드로이드·iPadOS 공통 media query + iOS 전용 플래그 */
function isStandaloneApp(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

/**
 * 공통 페이지 헤더 (2026-08-12)
 * 모든 페이지의 헤더 높이·패딩은 이 컴포넌트에서만 관리한다 — 페이지별 재정의 금지.
 * 내용은 슬롯(left/center/right)으로 조합하고, 뒤로가기는 backTo 로 내장.
 */
export function PageHeader({
  backTo,
  left,
  center,
  right,
  hideRightOnDesktop,
  hideBackWhenNoHistory,
}: PageHeaderProps) {
  const navigate = useNavigate()
  // React Router 가 엔트리마다 붙이는 history.state.idx — 0 이면 이 탭(웹앱)의 첫 화면.
  // location 을 구독해 화면 이동마다 다시 읽는다 (history.length 는 다른 사이트 엔트리까지 세서 못 쓴다)
  useLocation()
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0
  const hideBack = backTo === 'history' && !canGoBack && (hideBackWhenNoHistory || isStandaloneApp())

  const goBack = () => {
    if (backTo === 'history') {
      // 딥링크로 바로 진입해 히스토리가 없으면 홈으로
      if (canGoBack) navigate(-1)
      else navigate('/home')
      return
    }
    if (backTo) navigate(backTo)
  }

  return (
    <header className={styles.header}>
      <div className={styles.side}>
        {backTo != null && !hideBack && (
          <button type="button" aria-label="뒤로" onClick={goBack} className={styles.backButton}>
            <ChevronLeftIcon />
          </button>
        )}
        {left}
      </div>

      {center}

      <div className={clsx(styles.side, hideRightOnDesktop && styles.sideRightHidden)}>
        {right}
      </div>
    </header>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M12.5 4.5 7 10l5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
