import { useRef, type ReactNode, type Ref, type RefCallback } from 'react'
import { usePinchZoom } from '@/user/hooks/usePinchZoom'

/**
 * 두 손가락 확대·이동이 되는 스크롤 컨테이너 + 카드 한 쌍 (2026-09-03).
 *
 * usePinchZoom 의 state 를 이 컴포넌트 안에 격리한다 — 확대를 확정할 때마다 부모가 리렌더되면
 * 해설 패널처럼 MathJax 조판(dangerouslySetInnerHTML)을 담은 내용이 다시 그려져 조판이 풀린다.
 * children 은 부모가 만든 엘리먼트 그대로라 이 컴포넌트가 리렌더돼도 React 가 그 서브트리는 건너뛴다.
 */
export function PinchZoomScroller({
  className,
  cardClassName,
  cardRef,
  maxBaseWidth,
  children,
}: {
  /** 스크롤 컨테이너(overflow-y:auto) 클래스 */
  className?: string
  /** 카드(확대되는 상자 · min-height 에 var(--pinch-slack) 포함) 클래스 */
  cardClassName?: string
  /** 카드 DOM 을 부모도 써야 할 때 (필기 높이 확보 등) */
  cardRef?: Ref<HTMLDivElement>
  /** 1 배 기본 폭 상한(px) — 컨테이너 안쪽 폭이 더 넓어도 이 이상 안 커짐 */
  maxBaseWidth?: number
  children: ReactNode
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const innerCardRef = useRef<HTMLDivElement>(null)
  const pinch = usePinchZoom(scrollerRef, innerCardRef, { maxBaseWidth })

  const setCard: RefCallback<HTMLDivElement> = (el) => {
    innerCardRef.current = el
    if (typeof cardRef === 'function') cardRef(el)
    else if (cardRef) cardRef.current = el
  }

  return (
    <div ref={scrollerRef} className={className} style={pinch.scrollerStyle}>
      <div ref={setCard} className={cardClassName} style={pinch.cardStyle}>
        {children}
      </div>
    </div>
  )
}
