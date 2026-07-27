import { useRef } from 'react'

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

  // 이 컴포넌트는 상위 relative 컨테이너 안에서 absolute 로 배치됨.
  // 히트영역 (14px 폭) 을 오른쪽 border 라인 중앙에 맞추기 위해 translate-x-1/2 사용.
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="문제 · 해설 폭 조절"
      className="group absolute right-0 top-1/2 z-10 hidden md:flex md:h-14 md:w-[14px] md:-translate-y-1/2 md:translate-x-1/2 md:cursor-col-resize md:items-center md:justify-center touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 중앙 grip · 세로 캡슐 · border 라인 위에 겹쳐서 표시됨 · hover 시 진해짐 */}
      <div className="h-10 w-[5px] rounded-full bg-line shadow-[0_0_0_1px_rgba(255,255,255,0.6)] transition-colors group-hover:bg-body/60" />
    </div>
  )
}
