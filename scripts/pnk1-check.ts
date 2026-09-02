/**
 * PNK1 코덱 교차 검증 — 플랜 2026-09-02 "golden 파일로 디코더 검증 / pnk1_tool.py dump 로 인코더 대조".
 *
 *   node scripts/pnk1-check.ts <golden-dir> [out.pnk]
 *
 * 1) golden *.pnk 디코드 → 요약 출력 (pnk1_tool.py dump 결과와 눈으로 대조)
 * 2) 디코드 → 재인코드 → 디코드 라운드트립: 메타 동일 · 점 상대오차 1e-6 이내 (스펙 허용치)
 * 3) 풀잇 규약 샘플(origin top-left · mono/marker · force 1 · altitude 0) 인코드 → out.pnk
 *    → pnk1_tool.py dump / pnk2json 으로 헤더·CRC·점 값 대조
 * Node ≥ 22.6 (타입 스트리핑) · 코덱은 DOM 의존이 없어 브라우저 번들과 같은 코드가 돈다.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodePnk1, encodePnk1, type Pnk1Note, type Pnk1Point } from '../src/user/utils/pnk1.ts'

const [goldenDir, outPath] = process.argv.slice(2)
if (!goldenDir) {
  console.error('usage: node scripts/pnk1-check.ts <golden-dir> [out.pnk]')
  process.exit(1)
}

const approx = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-6, Math.max(Math.abs(a), Math.abs(b)) * 1e-6)
const withoutPoints = (note: Pnk1Note) => ({
  ...note,
  strokes: note.strokes.map(({ points, ...rest }) => rest),
})
const stable = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]]))
      : x,
  )

let failed = 0
const fail = (msg: string) => {
  failed++
  console.error('  FAIL', msg)
}

// 1) + 2)
for (const name of readdirSync(goldenDir).filter((f) => f.endsWith('.pnk')).sort()) {
  const bytes = new Uint8Array(readFileSync(join(goldenDir, name)))
  const note = decodePnk1(bytes)
  const points = note.strokes.reduce((n, s) => n + s.points.length, 0)
  const images = Array.isArray(note.images) ? note.images.length : 0
  const texts = Array.isArray(note.texts) ? note.texts.length : 0
  console.log(`${name}: file=${bytes.length}B id=${note.id} strokes=${note.strokes.length} points=${points} images=${images} texts=${texts}`)
  for (const s of note.strokes.slice(0, 3)) {
    console.log(`  type=${s.type} points=${s.points.length} width=${s.width} color=${s.color} first=${JSON.stringify(s.points[0])}`)
  }

  const back = decodePnk1(encodePnk1(note))
  if (stable(withoutPoints(back)) !== stable(withoutPoints(note))) fail(`${name}: meta mismatch after round-trip`)
  note.strokes.forEach((s, i) => {
    const t = back.strokes[i]
    if (!t || t.points.length !== s.points.length) return fail(`${name}: stroke[${i}] point count`)
    s.points.forEach((p, j) => {
      const q = t.points[j]
      for (const k of ['x', 'y', 'force', 'altitude'] as const) {
        if (!approx(p[k], q[k])) fail(`${name}: stroke[${i}] point[${j}] ${k} ${p[k]} vs ${q[k]}`)
      }
    })
  })
}

// 3) 풀잇 규약 샘플 — 350px 화면(배율 0.7)에서 찍힐 법한 소수 좌표
const pt = (x: number, y: number): Pnk1Point => ({ x, y, force: 1, altitude: 0 })
const sample: Pnk1Note = {
  id: 'a3d1e7a8-0000-4000-8000-000000000001',
  origin: 'top-left',
  images: [],
  texts: [],
  strokes: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'mono',
      color: '#120C0BFF',
      width: 4.9,
      rect: [10.5, 20.5, 25.7, 18.9],
      points: [pt(12.95, 22.95), pt(20.142857142857142, 30.71428571428571), pt(33.75, 36.95)],
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'marker',
      color: '#2563EB52',
      width: 11.2,
      rect: [94.4, 494.4, 111.2, 11.2],
      points: [pt(100, 500), pt(150.3, 500), pt(200, 500)],
    },
  ],
}
const encoded = encodePnk1(sample)
const back = decodePnk1(encoded)
if (stable(withoutPoints(back)) !== stable(withoutPoints(sample))) fail('sample: meta mismatch')
sample.strokes.forEach((s, i) =>
  s.points.forEach((p, j) => {
    const q = back.strokes[i].points[j]
    if (!approx(p.x, q.x) || !approx(p.y, q.y)) fail(`sample: stroke[${i}] point[${j}]`)
  }),
)
if (outPath) {
  writeFileSync(outPath, encoded)
  console.log(`sample: wrote ${outPath} (${encoded.length}B) — pnk1_tool.py dump/pnk2json 으로 대조`)
  console.log('sample decoded points:', JSON.stringify(back.strokes.map((s) => s.points.map((p) => [p.x, p.y]))))
}

console.log(failed === 0 ? 'PASS' : `FAILED (${failed})`)
process.exit(failed === 0 ? 0 : 1)
