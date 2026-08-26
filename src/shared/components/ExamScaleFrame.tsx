import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 시험지 스케일 프레임 (2026-08-26 확정) — 문제·해설 조판의 단일 크기 정책.
 *
 * 내용을 기준 폭(base=500 — 이 폭에서 본문 15px·패딩 16px 24px)으로 고정 조판해 두고,
 * 컨테이너 폭에 비례해 이미지처럼 통째로 확대/축소한다.
 * → 폭이 달라져도 줄바꿈이 절대 변하지 않는다 (어드민 검수 = 학생 화면, 배율만 다름).
 *
 * transform: scale 대신 zoom 을 쓴다 — zoom 은 레이아웃 크기에 그대로 반영되어
 * 높이 동기화 코드가 필요 없다 (KaTeX 지연 렌더로 높이가 변해도 자동 추종).
 */
export function ExamScaleFrame({
  base = 500,
  className,
  children,
}: {
  /** 기준 조판 폭(px) — 이 폭에서 배율 1 */
  base?: number
  className?: string
  children: ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const update = () => setScale(outer.clientWidth / base)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [base])

  return (
    <div ref={outerRef} className={className} style={{ width: '100%' }}>
      <div style={{ width: base, zoom: scale }}>{children}</div>
    </div>
  )
}
