import { useLayoutEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { KatexText } from './KatexText'
import { normalizeLiteralNewlines } from './ExamText'
import './exam.css'

/**
 * 해설 블록 스키마 렌더러 (2026-08-09 · B안 확정 포맷)
 *
 * AI 변환 파이프라인이 만드는 explanation 배열을 수능 조판으로 렌더한다.
 * 블록: paragraph(lead) · derivation(정렬 등식 체인) · formula(단일 식) ·
 *       cases((i)(ii) 분기) · conclusion(마무리) · note(부가 설명) · table · box(실선 박스)
 *       + 섹션 insight · solution · diagnosis (2026-09 3섹션 규격, ExplainBlocksRender 가 제목을 단다)
 *
 * 수식은 KatexText 재사용 — 수능 보정(굵은 |·큰 ∪∩·dfrac 승격)이 그대로 적용된다.
 * 단 **wrap 모드 고정** — 식마다 배율이 달라지면 한 해설 안에서 수식 크기가
 * 들쭉날쭉해지므로 자동 축소를 끄고, 크기는 컨테이너 폭 하나로만 결정한다
 * (.exam-blocks · 500px=15.5px ~ 350px=13px). 폭이 모자라면 줄바꿈으로 맞춘다
 * — 가로 스크롤은 쓰지 않는다.
 * derivation 의 & 정렬은 CSS grid 2열(.xb-steps)로 조판하되, 이 블록만은
 * 줄바꿈 대신 **블록 단위 균일 축소**로 맞춘다 (StepsBlock 주석 참고).
 */

export interface ExplainBlock {
  type: string
  /** paragraph · note */
  text?: string
  /** paragraph — 뒤따르는 수식을 이끄는 문장 (수식과 밀착) */
  lead?: boolean
  /** derivation — "좌변 &= 우변" 형태의 줄들 */
  lines?: string[]
  /** derivation — 식 참조 라벨(㉠~㉮). 뒤 문장에서 "㉠에서" 로 가리킨다 (2026-09 규격) */
  ref?: string
  /** formula */
  latex?: string
  /**
   * derivation · formula — 이 블록만 폰트 배율 (생성 파이프라인이 MathJax 실측으로 채움 · 2026-09-08 조판 규격).
   * 없으면 1.0. 런타임 폭 맞추기(StepsBlock)는 이 배율을 시작점으로 그 아래로만 더 줄인다
   */
  font_scale?: number
  /** derivation — true 면 & 등호 정렬을 포기하고 좌측 정렬 스택으로 그린다 (없으면 false = & 유무로 정렬 판단) */
  degrade_to_stacked?: boolean
  /** cases — {label, blocks} · diagnosis — {choice, role, blocks} (2026-09 3섹션 규격) */
  items?: Array<{ label?: string; choice?: number; role?: string; blocks: ExplainBlock[] }>
  /** conclusion · box · 섹션(insight·solution) */
  blocks?: ExplainBlock[]
  /** table — 셀 값은 $...$ 수식 문자열 */
  rows?: string[][]
  headers?: string[]
}

/** 블록 트리 전체의 문자열 필드에 리터럴 \n 교정 적용 (ExamText 와 동일 규칙) */
function normalizeBlock(b: ExplainBlock): ExplainBlock {
  return {
    ...b,
    text: b.text != null ? normalizeLiteralNewlines(b.text) : b.text,
    latex: b.latex != null ? normalizeLiteralNewlines(b.latex) : b.latex,
    lines: b.lines?.map(normalizeLiteralNewlines),
    rows: b.rows?.map((r) => r.map(normalizeLiteralNewlines)),
    headers: b.headers?.map(normalizeLiteralNewlines),
    items: b.items?.map((it) => ({ ...it, blocks: normalizeBlocks(it.blocks ?? []) })),
    blocks: b.blocks ? normalizeBlocks(b.blocks) : b.blocks,
  }
}

/** 수식($…$) 밖 괄호 잔여 개수 — 여는 괄호가 닫히지 않은 채 끝나면 양수 */
function parenBalance(text: string): number {
  let depth = 0
  let inMath = false
  for (const ch of text) {
    if (ch === '$') {
      inMath = !inMath
      continue
    }
    if (inMath) continue
    if (ch === '(') depth++
    else if (ch === ')') depth--
  }
  return depth
}

/**
 * 괄호 보조 설명이 여러 paragraph 로 쪼개진 데이터 병합 —
 * "(만약 …이면" / "…모순이다." / ")" 가 각각 딴 줄로 렌더되던 문제의 교정.
 * 여는 괄호가 안 닫힌 paragraph 는 뒤 paragraph 들을 이어 붙이되(최대 4개),
 * 실제로 닫혔을 때만 병합을 확정한다 — 홀괄호 데이터 폭주 방지.
 */
function mergeOpenParenParagraphs(blocks: ExplainBlock[]): ExplainBlock[] {
  const out: ExplainBlock[] = []
  let i = 0
  while (i < blocks.length) {
    const b = blocks[i]
    if (b.type === 'paragraph' && typeof b.text === 'string') {
      let text = b.text
      let bal = parenBalance(text)
      let j = i + 1
      while (
        bal > 0 &&
        j < blocks.length &&
        j - i <= 4 &&
        blocks[j].type === 'paragraph' &&
        typeof blocks[j].text === 'string'
      ) {
        text = `${text} ${blocks[j].text}`
        bal += parenBalance(blocks[j].text as string)
        j++
      }
      if (j > i + 1 && bal <= 0) {
        out.push({ ...b, text })
        i = j
        continue
      }
    }
    out.push(b)
    i++
  }
  return out
}

function normalizeBlocks(blocks: ExplainBlock[]): ExplainBlock[] {
  return mergeOpenParenParagraphs(blocks.map(normalizeBlock))
}

/**
 * 3섹션 해설(2026-09 규격) — 최상위가 insight·solution·diagnosis 섹션이면 섹션 제목을 달아 그린다.
 * 섹션 제목은 정책 확정 표기 그대로: [핵심 발상] · [풀이] · [선택지별 진단].
 * 구 평면 배열(섹션 없는 수학·영어 데이터)은 종전대로 블록을 순서대로 그린다.
 */
const SECTION_TITLES: Record<string, string> = {
  insight: '[핵심 발상]',
  solution: '[풀이]',
  diagnosis: '[선택지별 진단]',
}
function isSectionBlock(b: ExplainBlock): boolean {
  return Object.prototype.hasOwnProperty.call(SECTION_TITLES, b.type)
}

const CIRCLED = ['①', '②', '③', '④', '⑤']

/** diagnosis.items — 선지 번호(원문자 ①~⑤ · 명조 서체 · 정답은 메인 컬러) + 진단 본문 */
function renderDiagnosis(b: ExplainBlock): React.ReactNode {
  const items = b.items ?? []
  if (items.length === 0) return null
  return (
    <div className="xb-diag">
      {items.map((it, j) => {
        const no = typeof it.choice === 'number' ? it.choice : j + 1
        const correct = it.role === 'correct'
        return (
          <div key={j} className={clsx('xb-diag-item', correct && 'xb-diag-correct')}>
            <span className="xb-diag-num" aria-label={`${no}번${correct ? ' 정답' : ''}`}>
              {CIRCLED[no - 1] ?? String(no)}
            </span>
            <div className="xb-diag-body">
              {normalizeBlocks(it.blocks ?? []).map((c, k) => renderBlock(c, k))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderSection(b: ExplainBlock, key: number): React.ReactNode {
  const body =
    b.type === 'diagnosis'
      ? renderDiagnosis(b)
      : normalizeBlocks(b.blocks ?? []).map((c, i) => renderBlock(c, i))
  if (body == null || (Array.isArray(body) && body.length === 0)) return null
  return (
    <section key={key} className={`xb-section xb-section-${b.type}`}>
      <p className="xb-section-title">{SECTION_TITLES[b.type]}</p>
      <div className="xb-section-body">{body}</div>
    </section>
  )
}

export function ExplainBlocksRender({
  blocks,
  hideInsight = false,
  subject,
}: {
  blocks: ExplainBlock[]
  /** 영어는 핵심 발상 섹션을 보여주지 않는다 (2026-09-06 결정) — 데이터에 있어도 렌더에서 뺀다 */
  hideInsight?: boolean
  /**
   * 'math' 면 수학 해설지 실측 조판 규격(줄간격 2.3 · 블록 간격 · 전개식 행 간격)을 켠다 (2026-09-08).
   * 영어·미지정은 종전 간격 그대로 — 규격이 수학 해설지 실측이라 영어엔 적용하지 않는다
   */
  subject?: string | null
}) {
  if (hideInsight) blocks = blocks.filter((b) => b.type !== 'insight')
  const sectioned = blocks.some(isSectionBlock)
  const math = String(subject ?? '').toLowerCase() === 'math'
  return (
    // exam-explain-root 가 컨테이너 쿼리 기준 — 폭 350~500px 에 따라
    // .exam-blocks 폰트가 13~15.5px 로 움직인다 (MathExplainLayout 과 동일 규칙)
    <div className="exam-explain-root">
      <div className={clsx('exam-blocks', math && 'exam-blocks--math')}>
        {sectioned
          ? // 섹션 사이에 섞인 일반 블록(규격 위반 데이터)도 버리지 않고 제자리에 그린다
            blocks.map((b, i) => (isSectionBlock(b) ? renderSection(b, i) : renderBlock(normalizeBlock(b), i)))
          : normalizeBlocks(blocks).map((b, i) => renderBlock(b, i))}
      </div>
    </div>
  )
}

/** 끊어낼 최소 연속 개수 — 2 로 낮추면 "$\sin x + \cos x = t$ 라 하자" 처럼
 *  다음 문장에 걸린 식까지 끊긴다 (대수 6파일 실측). 3 에서는 오탐이 관측되지 않았다. */
const MIN_RUN = 3

const KOREAN = /[가-힣]/

/** 유도 단계로 볼 수식 — 등호가 있고 한 조각으로 서 있을 만큼 길어야 한다 */
function isDerivationStep(tex: string): boolean {
  const t = tex.trim()
  return t.includes('=') && t.replace(/\s/g, '').length >= 8
}

interface ParagraphChunk {
  /** 일반 문장 */
  text?: string
  /** 연속으로 붙어있던 유도 단계 수식들 */
  steps?: string[]
}

/**
 * 한 문단에 인라인으로 줄줄이 이어진 유도 과정을 끊어낸다.
 *
 * 변환 파이프라인이 derivation 블록으로 뽑지 못하고 paragraph 에 밀어넣은 데이터가 있다
 * (대수 6파일 기준 문단의 13%). 그대로 흘리면 등식이 문장처럼 이어져 읽을 수 없다.
 *
 * 판정은 보수적으로 — 다음을 모두 만족할 때만 끊는다. 애매하면 원문 그대로 둔다.
 * - **공백만 두고** 붙어있는 인라인 수식이 MIN_RUN 개 이상 (쉼표·조사·접속어가 끼면 제외)
 * - 전부 등식이고 조각이 충분히 길다 ("$x_1 = \alpha$, $x_2 = \pi-\alpha$" 같은 나열 배제)
 * - 마지막 식에 조사가 바로 붙지 않는다 ("$0 < a < 1$인 경우" 는 문장 중간이므로 제외)
 */
function splitInlineDerivation(raw: string): ParagraphChunk[] {
  const spans: Array<{ start: number; end: number; body: string }> = []
  const re = /\$[^$]+\$/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length, body: m[0].slice(1, -1) })
  }
  if (spans.length < MIN_RUN) return [{ text: raw }]

  const chunks: ParagraphChunk[] = []
  let cursor = 0
  let i = 0
  while (i < spans.length) {
    // i 에서 시작해 공백만으로 이어지는 최대 구간
    let j = i
    while (j + 1 < spans.length && raw.slice(spans[j].end, spans[j + 1].start).trim() === '') j++

    const run = spans.slice(i, j + 1)
    const attached = KOREAN.test(raw.slice(spans[j].end, spans[j].end + 1))
    if (run.length >= MIN_RUN && !attached && run.every((s) => isDerivationStep(s.body))) {
      const before = raw.slice(cursor, spans[i].start)
      if (before.trim()) chunks.push({ text: before })
      chunks.push({ steps: run.map((s) => s.body) })
      cursor = spans[j].end
    }
    i = j + 1
  }

  const tail = raw.slice(cursor)
  if (tail.trim()) chunks.push({ text: tail })
  return chunks.length > 0 ? chunks : [{ text: raw }]
}

/**
 * 정렬 기준 위치 — 이스케이프(\&)와 중괄호 안(\text{…}·배열 셀)은 건너뛴다.
 * & 가 없으면 최상위 첫 = 을 기준으로 삼는다 (수능 조판의 등호 정렬).
 */
function findAlignIndex(tex: string): { index: number; drop: boolean } {
  let depth = 0
  let firstEq = -1
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i]
    if (ch === '\\') {
      i++ // 이스케이프 시퀀스의 다음 한 글자는 판정 대상이 아니다
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (depth === 0) {
      if (ch === '&') return { index: i, drop: true } // & 자체는 버린다
      if (ch === '=' && firstEq === -1) firstEq = i
    }
  }
  return { index: firstEq, drop: false } // = 는 우변에 남긴다
}

/** 줄을 정렬 기준에서 좌변/우변으로 가른다 */
function splitAtAlign(tex: string): [string, string] {
  const { index, drop } = findAlignIndex(tex)
  if (index < 0) return [tex.trim(), '']
  return [tex.slice(0, index).trim(), tex.slice(drop ? index + 1 : index).trim()]
}

/**
 * 유도 단계 조판 — 줄마다 **독립 display 블록**으로 쌓는다.
 *
 * \begin{aligned} 로 묶으면 KaTeX 가 통짜 테이블(katex-base 1개)로 그려서
 * 컨테이너보다 넓어도 줄바꿈이 불가능하고 가로 스크롤로 떨어진다.
 * 줄·좌우변을 각각 독립 수식으로 쪼개 놓으면 KaTeX 0.18 이 이항연산자마다
 * katex-base 를 끊어 두므로 폭이 모자랄 때 그 경계에서 접힌다.
 *
 * 정렬은 aligned 대신 CSS grid 2열이 담당 — 1열(좌변) 우측 정렬 · 2열(우변)
 * 좌측 정렬로 등호가 세로로 맞고, 덩어리 자체는 가운데 배치된다.
 */
/** 유도 블록 축소 하한 — 가로 스크롤을 쓰지 않으므로 어떤 식이든 이 안에서 맞춘다 */
const MIN_STEPS_SCALE = 0.45

/**
 * 우변을 최상위 `=` 에서 등식 조각으로 나눈다 — "= B = C" → ["= B", "= C"].
 * 폭이 모자란 줄을 축소하기 전에 "A = B / = C" 로 행을 늘리는 용도 (2026-09-07).
 * 괄호·중괄호 안의 = 는 무시. 최상위 쉼표가 있으면(a = 4, b = 8 나열) 나누지 않는다.
 */
function splitRhsAtEquals(rhs: string): string[] | null {
  const segs: string[] = []
  let cur = ''
  let depth = 0
  for (let i = 0; i < rhs.length; i++) {
    const ch = rhs[i]
    if (ch === '\\') {
      cur += ch + (rhs[i + 1] ?? '')
      i++
      continue
    }
    if (ch === '{' || ch === '(' || ch === '[') depth++
    else if (ch === '}' || ch === ')' || ch === ']') depth--
    if (depth === 0 && ch === ',') return null
    if (depth === 0 && ch === '=' && cur.trim()) {
      segs.push(cur.trim())
      cur = '='
      continue
    }
    cur += ch
  }
  if (cur.trim()) segs.push(cur.trim())
  return segs.length >= 2 ? segs : null
}

/** 세로로 큰 글리프(분수·근호·합·적분·\left 괄호)가 든 행 — 행 간격을 더 준다 (2026-09-07) */
const TALL_STEP = /\\[dct]?frac|\\sqrt|\\sum|\\int|\\lim|\\binom|\\left\s*[(\[{|]|\\begin\{/

/** 줄들을 [좌변, 우변] 행으로 — split 이면 긴 우변을 등호 단위 행으로 늘린다 */
function toStepRows(lines: string[], split: boolean): Array<[string, string]> {
  const rows: Array<[string, string]> = []
  for (const line of lines) {
    const [lhs, rhs] = splitAtAlign(line)
    const parts = split ? splitRhsAtEquals(rhs) : null
    if (!parts) {
      rows.push([lhs, rhs])
      continue
    }
    parts.forEach((p, j) => rows.push([j === 0 ? lhs : '', p]))
  }
  return rows
}

/**
 * 유도 블록은 **접지 않고 블록 통째로 축소**해 폭을 맞춘다.
 *
 * 2열 그리드는 좌변(1열)·우변(2열)을 baseline 으로 붙여 등호를 세로로 맞추는데,
 * 좌변이 접히면 우변이 좌변의 **첫 줄**에 달라붙어
 * "304cos²(∠ABC) − = 0 / 144cos(∠ABC) − 148" 처럼 식이 뒤죽박죽으로 읽혔다.
 *
 * 그래서 이 블록만 셀 안 줄바꿈을 막고(.xb-steps 의 white-space: nowrap),
 * 가장 넓은 줄 기준으로 블록 전체에 같은 배율을 먹인다. 배율이 블록 단위라
 * 한 유도 안에서 수식 크기가 들쭉날쭉해지지 않는다.
 * 가로 스크롤은 쓰지 않는다 — 넘치면 축소로만 맞춘다.
 */
/** 유도 블록 조판 모드 — aligned: & 등호 세로 정렬 · sequential: & 없음, 좌측 스택 · stacked: & 무시, 좌측 스택(격하) */
type StepsMode = 'aligned' | 'sequential' | 'stacked'

function stepsMode(lines: string[], stacked: boolean): StepsMode {
  if (stacked) return 'stacked'
  return lines.some((l) => findAlignIndex(l).drop) ? 'aligned' : 'sequential'
}

function StepsBlock({
  lines,
  refLabel,
  fontScale,
  stacked = false,
}: {
  lines: string[]
  refLabel?: string
  /** 파이프라인이 준 블록 폰트 배율 (font_scale) — 런타임 축소의 시작점 */
  fontScale?: number
  /** degrade_to_stacked — & 무시하고 좌측 정렬 */
  stacked?: boolean
}) {
  // 0 < font_scale ≤ 1 만 신뢰 — 그 외(누락·이상값)는 1
  const base = typeof fontScale === 'number' && fontScale > 0 && fontScale <= 1 ? fontScale : 1
  const mode = stepsMode(lines, stacked)
  const wrapRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(base)
  const [scale, setScale] = useState(base)
  // 폭이 모자랄 때 축소보다 먼저 시도하는 "등호 단위 행 분해" (2026-09-07) —
  // "49 = A = B" 한 줄이 통째로 0.6배로 줄던 것을 "49 = A / = B" 두 행으로 편다
  const [split, setSplit] = useState(false)
  const splittable = lines.some((l) => splitRhsAtEquals(splitAtAlign(l)[1]) !== null)

  // 내용이 바뀌면 시작 배율(font_scale)에서 다시 측정 (이전 배율이 남으면 자연 폭을 못 구한다)
  useLayoutEffect(() => {
    scaleRef.current = base
    setScale(base)
    setSplit(false)
  }, [lines, base])

  useLayoutEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const grid = gridRef.current
    if (!wrap || !grid) return
    const measure = () => {
      const avail = wrap.clientWidth
      if (!avail) return
      // 그리드는 width:max-content 라 실측값이 곧 자연 폭 (현재 배율로 나눠 환산)
      const natural = grid.getBoundingClientRect().width / scaleRef.current
      const needed = avail / natural
      // 안 들어가면 먼저 등호 단위로 행을 늘려 본다 — 분해 후 다시 측정해 필요할 때만 축소
      if (needed < 1 && !split && splittable) {
        setSplit(true)
        return
      }
      // font_scale 이 시작점 — 들어가면 그 배율 그대로, 안 들어가면 그 아래로만 더 줄인다
      const next = needed >= base ? base : Math.max(MIN_STEPS_SCALE, needed * 0.98)
      if (Math.abs(next - scaleRef.current) > 0.02) setScale(next)
    }
    measure()
    // KaTeX 웹폰트가 늦게 뜨면 글리프 폭이 바뀌므로 재측정
    document.fonts?.ready.then(measure).catch(() => {})
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [lines, scale, split, splittable, base])

  const rows = toStepRows(lines, split)
  return (
    <div ref={wrapRef} className={clsx('xb-math xb-steps-fit', refLabel && 'has-ref')}>
      {/* 식 참조 라벨(㉠) — 수능 조판처럼 식 오른쪽 끝에 붙인다 */}
      {refLabel && <span className="xb-ref">{refLabel}</span>}
      <div
        ref={gridRef}
        className={clsx('xb-steps', `xb-steps--${mode}`)}
        style={scale < 1 ? { fontSize: `${scale}em` } : undefined}
      >
        {mode === 'aligned'
          ? // & 등호 정렬 — 2열 그리드: 1열(좌변) 우측 정렬 · 2열(우변) 좌측 정렬 → 등호가 세로로 맞는다.
            // 등호 분해된 이어지는 행은 좌변이 비어 "= C" 가 2열에 놓인다 (2026-09-08 조판 규격으로 복원)
            rows.map(([lhs, rhs], j) => {
              if (!lhs && !rhs) return null
              const tall = TALL_STEP.test(lhs + rhs)
              return (
                <div key={j} className={clsx('xb-step xb-step-row', tall && 'is-tall')}>
                  <span className="xb-step-l">{lhs ? <KatexText wrap text={`$$${lhs}$$`} /> : null}</span>
                  <span className="xb-step-r">{rhs ? <KatexText wrap text={`$$${rhs}$$`} /> : null}</span>
                </div>
              )
            })
          : // sequential(& 없음) · stacked(& 무시) — 한 행 = 한 줄 수식, 좌측 정렬 스택
            rows.map(([lhs, rhs], j) => {
              const tex = [lhs, rhs].filter(Boolean).join(' ')
              if (!tex) return null
              return (
                <div key={j} className={clsx('xb-step', TALL_STEP.test(tex) && 'is-tall')}>
                  <KatexText wrap text={`$$${tex}$$`} />
                </div>
              )
            })}
      </div>
    </div>
  )
}

/**
 * "A&=B, &C&=D" 처럼 열-쌍이 2개 이상 든 행을 등식별 행으로 분해.
 * 그대로 두면 splitAtAlign 이 첫 & 에서만 갈라 우변에 & 가 남고,
 * env 밖 & 는 KaTeX 파싱 에러 → 원문이 빨간 텍스트로 노출된다.
 * & 분할은 최상위(중괄호·\begin 환경 밖)만, \& 는 보존.
 */
function splitColumnPairs(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let braceDepth = 0
  let envDepth = 0
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\') {
      if (line.startsWith('\\begin{', i)) envDepth++
      else if (line.startsWith('\\end{', i)) envDepth--
      cur += ch + (line[i + 1] ?? '')
      i++
      continue
    }
    if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth--
    if (ch === '&' && braceDepth === 0 && envDepth === 0) {
      cells.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  cells.push(cur)
  if (cells.length <= 2) return [line]

  const out: string[] = []
  for (let i = 0; i < cells.length; i += 2) {
    const l = (cells[i] ?? '').trim()
    const r = (cells[i + 1] ?? '').trim()
    if (!l && !r) continue
    out.push(r ? `${l}&${r}` : l)
  }
  return out.length > 0 ? out : [line]
}

function renderSteps(
  lines: string[],
  key: number,
  refLabel?: string,
  opts?: { fontScale?: number; stacked?: boolean },
) {
  return (
    <StepsBlock
      key={key}
      lines={lines.flatMap(splitColumnPairs)}
      refLabel={refLabel}
      fontScale={opts?.fontScale}
      stacked={opts?.stacked}
    />
  )
}

/** box 안 paragraph — '|' 구분 줄들이면 표, 여러 줄이면 줄 단위 문단, 그 외는 일반 블록 */
function renderBoxChild(b: ExplainBlock, key: number): React.ReactNode {
  if (b.type !== 'paragraph' || !b.text) return renderBlock(b, key)
  const lines = b.text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length >= 2 && lines.every((l) => l.includes('|'))) {
    return renderBlock({ type: 'table', rows: lines.map((l) => l.split('|').map((c) => c.trim())) }, key)
  }
  if (lines.length >= 2) {
    return (
      <div key={key}>
        {lines.map((l, j) => (
          <p key={j} className="xb-p xb-box-line">
            <KatexText wrap text={l} />
          </p>
        ))}
      </div>
    )
  }
  return renderBlock(b, key)
}

function renderBlock(b: ExplainBlock, key: number): React.ReactNode {
  switch (b.type) {
    case 'paragraph': {
      // 빈 문단(text 없음·공백뿐) — 2026-09-07 수학 데이터에 3건. 빈 <p> 가 마진만 남기므로 건너뛴다
      if (!b.text?.trim()) return null
      const chunks = splitInlineDerivation(b.text)
      // 끊을 게 없으면 기존과 동일한 단일 문단
      if (chunks.length === 1 && chunks[0].steps === undefined) {
        return (
          <p key={key} className={clsx('xb-p', b.lead && 'xb-lead')}>
            <KatexText wrap text={chunks[0].text ?? ''} />
          </p>
        )
      }
      return (
        <div key={key}>
          {chunks.map((chunk, j) => {
            if (chunk.steps) return renderSteps(chunk.steps, j)
            // 뒤에 수식이 이어지는 문장은 lead 로 밀착
            const leadsMath = chunks[j + 1]?.steps !== undefined
            return (
              <p key={j} className={clsx('xb-p', leadsMath && 'xb-lead')}>
                <KatexText wrap text={chunk.text ?? ''} />
              </p>
            )
          })}
        </div>
      )
    }

    case 'derivation': {
      const lines = b.lines ?? []
      if (lines.length === 0) return null
      return renderSteps(lines, key, b.ref?.trim() || undefined, {
        fontScale: b.font_scale,
        stacked: b.degrade_to_stacked === true,
      })
    }

    case 'formula': {
      // font_scale — 이 식만 폰트 배율 (0 < s ≤ 1 만 신뢰)
      const fs = typeof b.font_scale === 'number' && b.font_scale > 0 && b.font_scale <= 1 ? b.font_scale : 1
      return (
        <div key={key} className="xb-math" style={fs < 1 ? { fontSize: `${fs}em` } : undefined}>
          <KatexText wrap text={`$$${b.latex ?? ''}$$`} />
        </div>
      )
    }

    case 'table': {
      const rows = b.rows ?? []
      if (rows.length === 0) return null
      return (
        <div key={key} className="exam-table-wrap">
          <table className="exam-table">
            {b.headers && b.headers.length > 0 && (
              <thead>
                <tr>
                  {b.headers.map((h, j) => (
                    <th key={j} className="exam-cell">
                      <KatexText text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="exam-cell">
                      <KatexText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    case 'cases':
      return (
        <div key={key} className="xb-cases">
          {(b.items ?? []).map((item, j) => {
            // label 과 첫 paragraph 를 한 문장으로 병합 —
            // "(i) …인 경우, ~일 때 …" 수능 조판 (쉼표 시작 데이터도 자연 연결)
            const [first, ...rest] = item.blocks ?? []
            const mergeFirst = first?.type === 'paragraph'
            // 본문이 label 과 같은 번호(①…)로 시작하는 데이터 — 중복 표기를 뗀다
            // ("① ①(AI 도구의…)" → "① (AI 도구의…)", 영어 오답 분석 실데이터 패턴)
            const label = item.label?.trim() ?? ''
            const rawFirst = (first?.text ?? '').trimStart()
            const firstText =
              label && rawFirst.startsWith(label)
                ? rawFirst.slice(label.length).trimStart()
                : rawFirst
            return (
              <div key={j} className="xb-case">
                <p className="xb-p">
                  <span className="xb-case-label">
                    <KatexText wrap text={item.label ?? ''} />
                  </span>
                  {mergeFirst && <KatexText wrap text={firstText} />}
                </p>
                {(mergeFirst ? rest : item.blocks ?? []).map((c, k) => (
                  <div key={k} className="xb-case-body">
                    {renderBlock(c, k)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )

    case 'conclusion':
      return (
        <div key={key} className="xb-conclusion">
          {(b.blocks ?? []).map((c, j) => renderBlock(c, j))}
        </div>
      )

    case 'note':
      return (
        <p key={key} className="xb-note">
          <KatexText wrap text={b.text ?? ''} />
        </p>
      )

    case 'box':
      // 실선 박스(문제 본문의 pv-box 와 같은 조판). 수학 해설 실데이터(2026-09-04 수능형)는
      // 증감표를 "x | ⋯ | -1 | ⋯\nf'(x) | + | 0 | −" 처럼 '|' 구분·줄바꿈 문단 하나로 담아 오므로
      // 그 문단은 표로, 그 밖의 여러 줄 문단은 줄마다 한 문단으로 푼다
      return (
        <div key={key} className="xb-box">
          {(b.blocks ?? []).map((c, j) => renderBoxChild(c, j))}
        </div>
      )

    default:
      // 미지의 블록 타입 — 텍스트가 있으면 문단 폴백, 없으면 스킵 (렌더는 끊지 않는다)
      if (b.text) {
        return (
          <p key={key} className="xb-p">
            <KatexText wrap text={b.text} />
          </p>
        )
      }
      return null
  }
}
