/**
 * PNK1 코덱 — 패스노트 필기 파일 포맷의 JS 구현.
 *
 * 스펙 정본: 01_plan/2026-07-20_필기 데이터 바이너리 하이브리드 포맷 전환.md "포맷 스펙 v1"
 * iOS PNK1Codec · Android Pnk1Codec · test-fixtures/stroke-binary/pnk1_tool.py 와 독립된 구현
 * (교차 검증: scripts/pnk1-check.ts — golden 디코드 · 인코드 결과를 pnk1_tool.py 로 대조).
 * DOM 의존 없음 — 브라우저·Node 공용.
 *
 * 레이아웃 (little-endian 고정)
 *   [0..4)   magic       ASCII "PNK1"
 *   [4..6)   version     u16 = 1
 *   [6..8)   pointStride u16 = 16 (리더는 ≥16 허용 — 앞 16B 만 해석하고 stride 단위로 전진 · <16 은 읽기 불가)
 *   [8..12)  metaLength  u32
 *   [12..16) blobLength  u32
 *   [16..20) crc32       u32 — meta+blob 전체 (IEEE/zlib)
 *   [20..)   메타 JSON(UTF-8) 이어서 점 블롭 (점 1개 = x, y, force, altitude 각 f32)
 *
 * 메타 JSON: { id, images, texts, strokes: [{ ...획 메타, pointCount, blobOffset }] }
 * — 기존 json 스키마에서 strokes[].points 만 블롭으로 뺀 형태. blobOffset 은 블롭 시작 기준 바이트.
 */

export const PNK1_HEADER_SIZE = 20
export const PNK1_POINT_STRIDE = 16
const PNK1_VERSION = 1
const MAGIC = [0x50, 0x4e, 0x4b, 0x31] // "PNK1"

export interface Pnk1Point {
  x: number
  y: number
  force: number
  altitude: number
}

/** 획 — points 외 키(id·type·color·width·rect·lineMode …)는 메타 JSON 그대로 보존 */
export interface Pnk1Stroke {
  [key: string]: unknown
  points: Pnk1Point[]
}

/** 페이지 — strokes 외 키(id·images·texts·origin …)는 메타 JSON 그대로 보존 */
export interface Pnk1Note {
  [key: string]: unknown
  strokes: Pnk1Stroke[]
}

/**
 * 검증·파싱 실패 — "읽기 불가". kind 로 호출부가 폴백을 가른다:
 * - corrupt: 매직·길이·CRC·레이아웃 불일치 — 파일이 깨진 것이라 버려도 잃을 게 없다
 * - unsupported: 버전이 지원 범위 밖 — 더 새 클라이언트가 쓴 멀쩡한 파일일 수 있어 덮어쓰면 안 된다
 */
export class Pnk1Error extends Error {
  readonly kind: 'corrupt' | 'unsupported'

  // 매개변수 프로퍼티(constructor(readonly kind)) 를 쓰지 않는다 — Node 타입 스트리핑(scripts/pnk1-check.ts)이 못 지운다
  constructor(message: string, kind: 'corrupt' | 'unsupported' = 'corrupt') {
    super(message)
    this.name = 'Pnk1Error'
    this.kind = kind
  }
}

/** force 정규화 — 스펙 엣지 규약 (쓰기·읽기 공통 · 기존 iOS 디코더 규칙을 스펙으로 승격) */
export function normalizeForce(f: number): number {
  return f > 1 ? Math.min(f / 1.2, 1) : f
}

export function encodePnk1(note: Pnk1Note): Uint8Array<ArrayBuffer> {
  const strokesMeta: Record<string, unknown>[] = []
  let blobLength = 0
  for (const s of note.strokes) {
    const { points, ...rest } = s
    strokesMeta.push({ ...rest, pointCount: points.length, blobOffset: blobLength })
    blobLength += points.length * PNK1_POINT_STRIDE
  }
  const meta = new TextEncoder().encode(JSON.stringify({ ...note, strokes: strokesMeta }))

  const out = new Uint8Array(PNK1_HEADER_SIZE + meta.length + blobLength)
  const view = new DataView(out.buffer)
  out.set(MAGIC, 0)
  view.setUint16(4, PNK1_VERSION, true)
  view.setUint16(6, PNK1_POINT_STRIDE, true)
  view.setUint32(8, meta.length, true)
  view.setUint32(12, blobLength, true)
  out.set(meta, PNK1_HEADER_SIZE)

  // 블롭 — 메타와 같은 순회 순서로 빈틈없이 팩킹 (마지막 획의 offset + count×16 = blobLength)
  let p = PNK1_HEADER_SIZE + meta.length
  for (const s of note.strokes) {
    for (const pt of s.points) {
      view.setFloat32(p, pt.x, true)
      view.setFloat32(p + 4, pt.y, true)
      view.setFloat32(p + 8, normalizeForce(pt.force), true)
      view.setFloat32(p + 12, pt.altitude, true)
      p += PNK1_POINT_STRIDE
    }
  }
  view.setUint32(16, crc32(out.subarray(PNK1_HEADER_SIZE)), true)
  return out
}

/** 검증(매직·버전·stride·길이·CRC·획 레이아웃) 후 디코드 — 실패는 전부 Pnk1Error */
export function decodePnk1(input: Uint8Array | ArrayBuffer): Pnk1Note {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.length < PNK1_HEADER_SIZE) throw new Pnk1Error('truncated header')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Pnk1Error('bad magic')
  }
  const version = view.getUint16(4, true)
  if (version !== PNK1_VERSION) throw new Pnk1Error(`unsupported version ${version}`, 'unsupported')
  const stride = view.getUint16(6, true)
  if (stride < PNK1_POINT_STRIDE) throw new Pnk1Error(`bad stride ${stride}`)
  const metaLength = view.getUint32(8, true)
  const blobLength = view.getUint32(12, true)
  if (PNK1_HEADER_SIZE + metaLength + blobLength !== bytes.length) {
    throw new Pnk1Error('length mismatch')
  }
  const body = bytes.subarray(PNK1_HEADER_SIZE)
  if (crc32(body) !== view.getUint32(16, true)) throw new Pnk1Error('crc mismatch')

  let meta: unknown
  try {
    meta = JSON.parse(new TextDecoder().decode(body.subarray(0, metaLength)))
  } catch {
    throw new Pnk1Error('bad meta json')
  }
  if (!isRecord(meta)) throw new Pnk1Error('bad meta json')
  const rawStrokes = meta.strokes ?? []
  if (!Array.isArray(rawStrokes)) throw new Pnk1Error('bad strokes')

  const blobBase = PNK1_HEADER_SIZE + metaLength
  const strokes = rawStrokes.map((raw): Pnk1Stroke => {
    if (!isRecord(raw)) throw new Pnk1Error('bad stroke meta')
    const { pointCount, blobOffset, ...rest } = raw
    if (!isUint(pointCount) || !isUint(blobOffset) || blobOffset + pointCount * stride > blobLength) {
      throw new Pnk1Error('stroke layout out of bounds')
    }
    const points: Pnk1Point[] = new Array(pointCount)
    let p = blobBase + blobOffset
    for (let i = 0; i < pointCount; i++) {
      points[i] = {
        x: view.getFloat32(p, true),
        y: view.getFloat32(p + 4, true),
        force: normalizeForce(view.getFloat32(p + 8, true)),
        altitude: view.getFloat32(p + 12, true),
      }
      p += stride
    }
    return { ...rest, points }
  })
  return { ...meta, strokes }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isUint = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32 (IEEE/zlib) — iOS zlib crc32 · Android java.util.zip.CRC32 와 동일 */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
