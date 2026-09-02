/**
 * 문제 필기 획 모델 — PNK1 저장 단위와 1:1 (플랜 2026-09-02 "풀잇 필기 저장 — PNK1 포맷 도입").
 *
 * 좌표계: 기준 폭 500 조판(ExamScaleFrame base)의 px · 좌상단 원점 · y 는 아래로 증가.
 * 화면 px 이 아니라 배율(컨테이너 폭 ÷ 500)을 나눈 값이라 폭이 달라져도 본문 위 같은 자리를 가리킨다.
 * 굵기(width)도 같은 단위 — 필기가 본문과 함께 확대·축소된다.
 * 패스노트(좌하단 원점 · y-up · PDF point)와는 y 축만 반대 — 변환 규칙은 플랜 "나중에 — 패스노트로 가져가기".
 */

/** 저장되는 획 타입 — 펜 = mono · 형광펜 = marker (패스노트 PNK1 과 같은 이름이라 변환 매핑이 없다) */
export type NoteStrokeType = 'mono' | 'marker'

export interface NoteStroke {
  /** UUID — 패스노트 스트로크 id 와 같은 형식 */
  id: string
  type: NoteStrokeType
  /** #RRGGBB */
  color: string
  /** 굵기(지름) — 기준 폭 500 조판 px */
  width: number
  /** [x, y, w, h] — 점 bbox 를 width/2 만큼 넓힌 것 (패스노트 규약 · 지우개 판정·캔버스 높이 계산에 사용) */
  rect: [number, number, number, number]
  /** [x, y] 목록 — 기준 폭 500 조판 좌표 */
  points: number[][]
}

/**
 * 점 bbox 를 굵기 절반만큼 넓힌 rect — 패스노트와 같은 규약
 * (golden 01_simple_brush: 점 10~28 · width 3 → rect 8.5~29.5).
 */
export function strokeRect(
  points: readonly number[][],
  width: number,
): [number, number, number, number] {
  if (points.length === 0) return [0, 0, 0, 0]
  let minX = points[0][0]
  let maxX = minX
  let minY = points[0][1]
  let maxY = minY
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i]
    if (x < minX) minX = x
    else if (x > maxX) maxX = x
    if (y < minY) minY = y
    else if (y > maxY) maxY = y
  }
  const half = width / 2
  return [minX - half, minY - half, maxX - minX + width, maxY - minY + width]
}

/** 필기가 차지하는 세로 끝 (조판 px) — max(rect.y + rect.h) · 획이 없으면 0 */
export function noteBottom(strokes: readonly NoteStroke[]): number {
  let bottom = 0
  for (const s of strokes) bottom = Math.max(bottom, s.rect[1] + s.rect[3])
  return bottom
}

/**
 * 획 id — randomUUID 는 보안 컨텍스트(HTTPS·localhost) 전용이라 사설 IP http
 * (모바일 LAN 테스트)에선 getRandomValues 로 v4 형식을 직접 조립한다.
 */
export function newStrokeId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
