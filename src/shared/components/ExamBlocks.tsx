import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { KatexText } from './KatexText'
import './exam.css'

/**
 * 해설 블록 스키마 렌더러 (2026-08-09 · B안 확정 포맷)
 *
 * AI 변환 파이프라인이 만드는 explanation 배열을 수능 조판으로 렌더한다.
 * 블록: paragraph(lead) · derivation(정렬 등식 체인) · formula(단일 식) ·
 *       cases((i)(ii) 분기) · conclusion(마무리) · note(부가 설명)
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
  /** formula */
  latex?: string
  /** cases */
  items?: Array<{ label: string; blocks: ExplainBlock[] }>
  /** conclusion */
  blocks?: ExplainBlock[]
}

export function ExplainBlocksRender({ blocks }: { blocks: ExplainBlock[] }) {
  return (
    // exam-explain-root 가 컨테이너 쿼리 기준 — 폭 350~500px 에 따라
    // .exam-blocks 폰트가 13~15.5px 로 움직인다 (MathExplainLayout 과 동일 규칙)
    <div className="exam-explain-root">
      <div className="exam-blocks">{blocks.map((b, i) => renderBlock(b, i))}</div>
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
function StepsBlock({ lines }: { lines: string[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const [scale, setScale] = useState(1)

  // 내용이 바뀌면 원래 크기에서 다시 측정 (이전 배율이 남으면 자연 폭을 못 구한다)
  useLayoutEffect(() => {
    scaleRef.current = 1
    setScale(1)
  }, [lines])

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
      const next = needed >= 1 ? 1 : Math.max(MIN_STEPS_SCALE, needed * 0.98)
      if (Math.abs(next - scaleRef.current) > 0.02) setScale(next)
    }
    measure()
    // KaTeX 웹폰트가 늦게 뜨면 글리프 폭이 바뀌므로 재측정
    document.fonts?.ready.then(measure).catch(() => {})
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [lines, scale])

  return (
    <div ref={wrapRef} className="xb-math xb-steps-fit">
      <div
        ref={gridRef}
        className="xb-steps"
        style={scale < 1 ? { fontSize: `${scale}em` } : undefined}
      >
        {lines.map((line, j) => {
          const [lhs, rhs] = splitAtAlign(line)
          return (
            <Fragment key={j}>
              {/* 빈 쪽은 수식을 렌더하지 않는다 — 빈 display 블록이 줄 높이를 늘린다 */}
              <span className="xb-step-l">{lhs && <KatexText wrap text={`$$${lhs}$$`} />}</span>
              <span className="xb-step-r">{rhs && <KatexText wrap text={`$$${rhs}$$`} />}</span>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

function renderSteps(lines: string[], key: number) {
  return <StepsBlock key={key} lines={lines} />
}

function renderBlock(b: ExplainBlock, key: number): React.ReactNode {
  switch (b.type) {
    case 'paragraph': {
      const chunks = splitInlineDerivation(b.text ?? '')
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
      return renderSteps(lines, key)
    }

    case 'formula':
      return (
        <div key={key} className="xb-math">
          <KatexText wrap text={`$$${b.latex ?? ''}$$`} />
        </div>
      )

    case 'cases':
      return (
        <div key={key} className="xb-cases">
          {(b.items ?? []).map((item, j) => {
            // label 과 첫 paragraph 를 한 문장으로 병합 —
            // "(i) …인 경우, ~일 때 …" 수능 조판 (쉼표 시작 데이터도 자연 연결)
            const [first, ...rest] = item.blocks ?? []
            const mergeFirst = first?.type === 'paragraph'
            return (
              <div key={j} className="xb-case">
                <p className="xb-p">
                  <span className="xb-case-label">
                    <KatexText wrap text={item.label} />
                  </span>
                  {mergeFirst && <KatexText wrap text={first.text ?? ''} />}
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
