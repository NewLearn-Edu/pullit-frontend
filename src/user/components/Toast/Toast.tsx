import { useEffect, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import styles from './styles/Toast.module.scss'

const OUT_MS = 200

interface ToastProps {
  /** true 면 떠오르고, false 로 바뀌면 가라앉는 애니메이션 뒤에 내려간다 */
  show: boolean
  children: ReactNode
  /** 화면 아래에서 띄울 거리 — 기본: 하단 네비 위 16px */
  bottom?: string
  /**
   * 이 셀렉터의 요소(fixed 하단 바) 바로 위에 띄운다 — 요소 높이를 실제로 재서 bottom 을 정하므로
   * 바 높이가 화면마다 달라도 겹치지 않는다. 지정하면 bottom 은 무시
   */
  anchorSelector?: string
  /** 카드 폭을 내용에 맞춤 (알약형 미니 토스트) — 기본은 100% · 최대 620px */
  fit?: boolean
  /** 카드 외형 — 배경·패딩·라운드 등은 호출부가 정한다 */
  className?: string
  role?: 'status' | 'alert'
}

/**
 * 하단 토스트 공용 래퍼.
 * - 등장: 아래에서 위로 떠오름 · 퇴장: 아래로 가라앉으며 페이드 (show=false 뒤 200ms 유지)
 * - PC 좌측 사이드바(UserNav, data-side-nav)가 보이면 그 오른쪽 콘텐츠 영역의 가운데에 놓인다
 * - 퇴장 중엔 마지막 내용을 그대로 보여준다 (호출부가 메시지를 null 로 비워도 안 깜빡임)
 */
export function Toast({
  show,
  children,
  bottom,
  anchorSelector,
  fit = false,
  className,
  role = 'status',
}: ToastProps) {
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>(show ? 'in' : 'hidden')
  const [content, setContent] = useState<ReactNode>(children)
  const sideNavRight = useSideNavRight()
  const anchor = useAnchorBottom(anchorSelector, phase !== 'hidden')

  useEffect(() => {
    if (show) {
      setContent(children)
      setPhase('in')
      return
    }
    setPhase((p) => (p === 'hidden' ? p : 'out'))
    const timer = window.setTimeout(() => setPhase('hidden'), OUT_MS)
    return () => window.clearTimeout(timer)
  }, [show, children])

  if (phase === 'hidden') return null

  return (
    <div
      className={styles.wrap}
      style={{
        left: sideNavRight,
        bottom: anchor?.bottom ?? bottom ?? 'calc(var(--nav-bottom-h, 0px) + 16px)',
      }}
    >
      <div
        role={role}
        className={clsx(styles.card, fit && styles.fit, phase === 'out' && styles.out, className)}
        // 앵커 바가 있으면 그 폭에 맞춘다 (답안 바 500px 과 같은 폭으로 정렬)
        style={anchor ? { maxWidth: anchor.width } : undefined}
      >
        {content}
      </div>
    </div>
  )
}

/** PC 사이드바 오른쪽 끝 x — 사이드바가 없거나 숨겨진(모바일·풀이 화면) 경우 0 */
function useSideNavRight(): number {
  const [right, setRight] = useState(0)
  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector<HTMLElement>('[data-side-nav]')
      const rect = nav?.getBoundingClientRect()
      setRight(rect && rect.width > 0 ? Math.round(rect.right) : 0)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  return right
}

const ANCHOR_GAP = 12

/** 앵커(하단 고정 바) 위쪽 끝까지의 거리와 폭 — 바 크기가 바뀌면(ResizeObserver) 따라간다 */
function useAnchorBottom(
  selector: string | undefined,
  active: boolean,
): { bottom: string; width: number } | null {
  const [value, setValue] = useState<{ bottom: string; width: number } | null>(null)
  useEffect(() => {
    if (!selector || !active) return
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) {
      setValue(null)
      return
    }
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setValue({
        bottom: `${Math.max(0, Math.round(window.innerHeight - rect.top)) + ANCHOR_GAP}px`,
        width: Math.round(rect.width),
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [selector, active])
  return value
}
