import { useRef } from 'react'
import styles from './styles/ResizeDivider.module.scss'

interface ResizeDividerProps {
  show: boolean
  onStart: () => void
  /** delta X (px). 양수 = 우측으로 이동 = 우측 패널 폭 감소 */
  onDrag: (deltaX: number) => void
  onEnd: () => void
}

/**
 * 문제 · 해설 패널 사이 세로 드래그 divider.
 * md+ 에서만 표시 · 해설 패널 open 상태일 때만 나타남.
 * 마우스 · 손가락 · Apple Pencil 모두 지원 (Pointer Events).
 */
export function ResizeDivider({ show, onStart, onDrag, onEnd }: ResizeDividerProps) {
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className={styles.grip} />
    </div>
  )
}
