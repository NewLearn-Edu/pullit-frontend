import { useEffect, useRef, useState } from 'react'

/**
 * 고정 픽셀로 그린 스테이지(폰 목업·단원 지도)를 컨테이너 크기에 맞춰 transform: scale 로 줄인다.
 * 시안은 데스크톱 px 기준이라 패드·폰에서는 비율만 유지한 채 축소 — 레이아웃 재계산이 없어 깨지지 않는다.
 */
export function useFitScale(baseW: number, baseH?: number, max = 1) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(max)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      const byW = width / baseW
      const byH = baseH ? height / baseH : Infinity
      setScale(Math.min(max, byW, byH))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [baseW, baseH, max])

  return { ref, scale }
}
