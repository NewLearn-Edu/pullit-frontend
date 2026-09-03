import { useRef } from 'react'
import styles from './styles/ResizeDivider.module.scss'

interface ResizeDividerProps {
  show: boolean
  /** 우측 패널 폭(px) — divider 를 문제·패널 경계선 위에 놓는 기준 */
  offset: number
  /** 드래그 중이 아닐 때 true — 패널 폭 transition(300ms) 을 따라 같이 움직인다 */
  animated: boolean
  onStart: () => void
  /** delta X (px). 양수 = 우측으로 이동 = 우측 패널 폭 감소 */
  onDrag: (deltaX: number) => void
  onEnd: () => void
}

/**
 * 문제 · 해설 패널 사이 세로 드래그 divider.
 * md+ 에서만 표시 · 해설 패널 open 상태일 때만 나타남.
 * 마우스 · 손가락 · Apple Pencil 모두 지원 (Pointer Events).
 *
 * 문제 영역(main · overflow auto) 의 자식이 아니라 문제·패널을 감싸는 컨테이너(.content) 의 자식으로
 * 두고 right = 패널 폭으로 경계선에 얹는다 — iPadOS Safari 는 스크롤 컨테이너 밖으로 삐져나온
 * 절반을 터치 히트 대상에서 잘라내서(2026-09-03 시뮬레이터 재현) 패널 쪽 절반이 안 잡혔다.
 */
export function ResizeDivider({ show, offset, animated, onStart, onDrag, onEnd }: ResizeDividerProps) {
  const lastXRef = useRef(0)
  const draggingRef = useRef(false)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    lastXRef.current = e.clientX
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onStart()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const dx = e.clientX - lastXRef.current
    lastXRef.current = e.clientX
    if (dx !== 0) onDrag(dx)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    onEnd()
  }

  if (!show) return null

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="문제 · 해설 폭 조절"
      className={styles.divider}
      style={{ right: offset, transition: animated ? 'right 300ms ease' : 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className={styles.grip} />
    </div>
  )
}
