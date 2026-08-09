import { useRef, useState } from 'react'

/**
 * 바텀시트 "아래로 스와이프 닫기" 공용 제스처.
 * - 8px 이동 임계값으로 탭과 드래그 구분
 * - 드래그 중 손가락 1:1 추종 (--drag-y CSS 변수) · threshold 초과 후 놓으면 onClose
 * - 드래그로 끝난 제스처의 잔여 click 무시 (시트 안 버튼 오발동 방지)
 * - disabled() 가 true 면 제스처 비활성 (예: 웹에서 사이드 패널/다이얼로그로 배치될 때)
 *
 * 사용: <div {...sheetProps} className={clsx(styles.sheet, dragging && styles.sheetDragging)}>
 * 시트 CSS 에서 transform: translateY(var(--drag-y, 0px)) + 복귀 트랜지션을 선언할 것.
 */
export function useSheetDrag(
  onClose: () => void,
  options: { threshold?: number; disabled?: () => boolean } = {},
) {
  const { threshold = 96, disabled } = options

  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ startY: number; id: number; active: boolean } | null>(null)
  const dragged = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation() // 뒤 레이어(캔버스 팬·딤)로 전파 금지
    if (disabled?.()) return
    drag.current = { startY: e.clientY, id: e.pointerId, active: false }
    dragged.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    const dy = e.clientY - d.startY
    if (!d.active && dy > 8) {
      d.active = true
      dragged.current = true
      setDragging(true)
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    }
    if (d.active) setDragY(Math.max(0, dy))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (d?.active && e.clientY - d.startY > threshold) onClose()
    setDragY(0)
  }

  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault()
      e.stopPropagation()
      dragged.current = false
    }
  }

  return {
    dragging,
    sheetProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
      style: { '--drag-y': `${dragY}px` } as React.CSSProperties,
    },
  }
}
