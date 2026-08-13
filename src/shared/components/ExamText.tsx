import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { KatexText, renderInlineHtml } from './KatexText'
import './exam.css'

/**
 * 수능 문제 본문 렌더러 — 문제·지문 텍스트의 마크업 3종을 처리한다.
 *
 * 1. `백틱 구간`   → 박스 (주어진 문장 · (가)(나)(다) 조건 박스). boxClassName 으로 스타일 지정
 * 2. <u>밑줄</u>   → 실제 밑줄 (어휘 · 어법 유형)
 * 3. $...$ · $$...$$ → KaTeX 수식 (KatexText 위임 · 블록은 가운데 정렬)
 *
 * 페이지에서 직접 쓰지 말 것 — ExamRender 의 4종 컴포넌트를 통해서만 사용.
 */
/**
 * 데이터에 문자 그대로 들어온 "\n"(백슬래시+n)을 실제 개행으로 교정.
 * 변환 파이프라인 이스케이프 실수 잔재 (_ebs_refined 기준 16건).
 * 뒤가 영문자면 TeX 명령(\neq·\nabla·\not 등)이므로 건드리지 않는다.
 */
function normalizeLiteralNewlines(text: string): string {
  return text.replace(/\\n(?![a-zA-Z])/g, '\n')
}

/**
 * 보기 원기호(①…⑮) 앞 강제 줄바꿈 — "④ …습니다.  ⑤ 참가비는 없습니다." 처럼
 * 데이터에 개행 없이 이어진 보기가 같은 줄에 렌더되던 문제의 교정.
 * 앞뒤가 모두 공백인 원기호만 보기 항목으로 판정 — "이를 ①에 대입" · "①, ②에서"
 * 같은 참조 용법(뒤에 공백 없음)은 건드리지 않는다.
 */
function breakBeforeChoiceMarkers(text: string): string {
  return text.replace(/([^\n\s])[ \t]+([①-⑮])(?=[ \t])/g, '$1\n$2')
}

export function ExamText({
  text,
  boxClassName = 'pv-box',
}: {
  text: string
  boxClassName?: string
}) {
  const segments = breakBeforeChoiceMarkers(normalizeLiteralNewlines(String(text ?? ''))).split('`')
  // 박스 경계의 개행 흡수 — 데이터의 \n\n 이 빈 줄로 렌더되어 박스 마진과 겹치면
  // 박스 위아래에 큰 공백이 생긴다 (간격은 박스 CSS 마진이 담당)
  const cleaned = segments.map((segment, i) => {
    if (i % 2 === 1) return segment
    let out = segment
    if (i > 0) out = out.replace(/^[ \t]*\n+[ \t]*/, '')
    if (i < segments.length - 1) out = out.replace(/[ \t]*\n+[ \t]*$/, '')
    return out
  })
  return (
    <>
      {cleaned.map((segment, i) =>
        i % 2 === 1 ? (
          <div key={i} className={boxClassName}>
            <BoxContent text={segment} />
          </div>
        ) : (
          // 본문 속 마크다운 파이프 표(표준정규분포표 등)는 해설과 같은 실선 표로.
          // 표가 없으면 splitMarkdownTables 가 통짜 text 블록 하나를 돌려줘 기존과 동일
          <Fragment key={i}>
            {splitMarkdownTables(segment).map((b, j) =>
              b.rows ? (
                <ExamTable key={j} rows={b.rows} />
              ) : (
                <UnderlinedText key={j} text={b.text ?? ''} />
              ),
            )}
          </Fragment>
        ),
      )}
    </>
  )
}

/**
 * 해설 레이아웃 — LaTeX 조판을 표준으로 한 구조화 렌더.
 *
 * · 빈 줄 = 문단 경계 (문단 사이 큰 여백)
 * · 문장(줄) 단위로 분리해 각 줄에 숨쉴 여백
 * · 등식 체인은 형태 불문(A=B=C 한 줄 · "= …" 연속 줄 · $$ 안의 \\)
 *   전부 \begin{aligned} 블록으로 수렴 — = 에 맞춰 정렬된 지면 조판
 * · display 블록은 컨테이너(350~500px)에 맞게 자동 축소 (KatexText.BlockMath)
 * · 증감표(마크다운 파이프 표)는 실선 표
 */
/**
 * 여는 괄호가 안 닫힌 채 줄이 끝나면 다음 줄을 이어 붙인다.
 * "(만약 $f(b) \le 0$이면\n$g(t)$가 … 모순이다.)" 같은 괄호 보조 설명이
 * 줄 단위 조판에서 세 줄로 갈라지던 문제의 교정.
 * 괄호 카운트는 수식($…$·$$…$$) 밖 텍스트만 — TeX 괄호와 섞이지 않게.
 * 빈 줄(문단 경계)은 접지 않고 깊이를 리셋한다 (홀괄호 데이터 폭주 방지).
 */
function foldOpenParenNewlines(text: string): string {
  let out = ''
  let depth = 0
  let inMath = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '$') {
      inMath = !inMath
      out += ch
      i++
      continue
    }
    if (!inMath) {
      if (ch === '(') depth++
      else if (ch === ')') depth = Math.max(0, depth - 1)
      else if (ch === '\n') {
        if (/^[ \t]*\n/.test(text.slice(i + 1))) {
          depth = 0 // 빈 줄 = 문단 경계 — 접기 중단
        } else if (depth > 0) {
          out += ' '
          i++
          continue
        }
      }
    }
    out += ch
    i++
  }
  return out
}

export function MathExplainLayout({ text }: { text: string }) {
  const blocks = splitMarkdownTables(
    foldOpenParenNewlines(normalizeLiteralNewlines(String(text ?? ''))),
  )
  return (
    // exam-explain-root 가 컨테이너 쿼리 기준 — 폭 350~500px 에 따라
    // 내부(exam-explain-scale) 폰트가 13~15px 로 유동적으로 줄어든다
    <div className="exam-explain-root">
      <div className="exam-explain-scale">
        {blocks.map((b, i) =>
          b.rows ? (
            <ExamTable key={i} rows={b.rows} />
          ) : (
            // 영역(exam-explain-p) 분할은 ExplainPara 가 담당 — 빈 줄·마커에 더해
            // $$ 가운데 식(+이어지는 꼬리) 뒤에서도 영역을 끊는다
            splitParas(b.text ?? '').map((para, j) => <ExplainPara key={`${i}-${j}`} para={para} />)
          ),
        )}
      </div>
    </div>
  )
}

/**
 * 영역(문단) 경계 마커 — 케이스 구분 (i)·(ii)·(가) 와 담화 표지.
 * 빈 줄이 없는 해설에서도 논리 구역이 시각적으로 나뉘도록 한다
 */
const PARA_START =
  /^(\([ivxIVXⅰ-ⅹ]+\)|\([가-힣]\)|\[\d+단계\]|조건\s*\(|따라서|그러므로|즉[,\s]|만약|한편|그러면|이때|여기서|그런데|또한)/

/** 빈 줄 우선, 이어서 영역 마커로 시작하는 줄에서 문단 분리 */
function splitParas(text: string): string[] {
  // 문장 중간에 파묻힌 케이스 마커("… = 128 (i) a = b²인 경우 …")는 마커 앞에서
  // 줄을 끊어 line-start 마커로 승격 — 단, "(i), (ii)에 의하여" 같은 참조 표현은
  // 마커 뒤에 공백이 없어 매칭되지 않음
  const marked = text.replace(
    /([^\n])[ \t]+(\((?:i{1,3}|iv|v|vi{0,3}|ix|x|ⅰ|ⅱ|ⅲ|ⅳ|ⅴ|ⅵ)\))[ \t]+/g,
    '$1\n$2 ',
  )
  const out: string[] = []
  for (const rough of marked.split(/\n[ \t]*\n+/)) {
    let cur: string[] = []
    for (const ln of rough.split('\n')) {
      if (cur.length > 0 && PARA_START.test(ln.trim())) {
        out.push(cur.join('\n'))
        cur = []
      }
      cur.push(ln)
    }
    if (cur.length > 0) out.push(cur.join('\n'))
  }
  return out.map((p) => p.trim()).filter(Boolean)
}

/* ── 등식 체인 → aligned 변환 ──────────────────────────────────── */

/** 수식 하나(+짧은 한글 꼬리)로만 된 줄 매칭 */
const LINE_BLOCK = /^\$\$([\s\S]+?)\$\$([가-힣.,·()!?\s]{0,10})$/
const LINE_INLINE = /^\$([^$]+)\$([가-힣.,·()!?\s]{0,10})$/

function matchMathOnly(line: string): { tex: string; tail: string; isBlock: boolean } | null {
  const b = line.match(LINE_BLOCK)
  if (b) return { tex: b[1].trim(), tail: b[2] ?? '', isBlock: true }
  const m = line.match(LINE_INLINE)
  if (m) return { tex: m[1].trim(), tail: m[2] ?? '', isBlock: false }
  return null
}

/** 최상위(괄호 밖) = 에서 분할 — "= B" 형태로 = 를 행 머리에 유지 */
function splitTopEquals(tex: string): string[] {
  const segs: string[] = []
  let depth = 0
  let cur = ''
  for (const c of tex) {
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    if (c === '=' && depth === 0 && cur.trim()) {
      segs.push(cur)
      cur = '='
    } else {
      cur += c
    }
  }
  if (cur.trim()) segs.push(cur)
  return segs.map((s) => s.trim()).filter(Boolean)
}

/** 첫 행의 첫 최상위 = 앞에 & 삽입 (aligned 정렬 앵커) */
function anchorFirstRow(row: string): string {
  let depth = 0
  for (let i = 0; i < row.length; i++) {
    const c = row[i]
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    if (c === '=' && depth === 0) return `${row.slice(0, i)}&${row.slice(i)}`
  }
  return row
}

/**
 * 행 목록 → aligned TeX.
 * · 첫 행에 = 가 있으면: A &= B 로 앵커 — 이후 = 행들이 그 = 열에 정렬
 * · 첫 행이 좌변 단독이면: 전 행을 & 뒤(왼쪽 정렬 열)에 둠 — = 행이 좌변 폭만큼
 *   오른쪽으로 밀리며 블록이 넓어지는(→ 자동 축소 유발) 계단 현상 방지
 * · = 없는 이어짐 행(+ …)은 들여쓰기로 구분
 */
function toAlignedTex(rows: string[]): string {
  const anchored = anchorFirstRow(rows[0])
  const hasAnchor = anchored !== rows[0]
  const body = [
    hasAnchor ? anchored : `&${rows[0]}`,
    ...rows.slice(1).map((r) => (r.startsWith('=') ? `&${r}` : `&\\quad ${r}`)),
  ].join(' \\\\[10pt] ')
  return `\\begin{aligned}${body}\\end{aligned}`
}

/** aligned·gathered 감싸개 해체 — 행 재배치를 위해 & 정렬 문자도 제거 */
function unwrapAlignEnv(tex: string): string {
  return tex
    .replace(/\\(begin|end)\{(aligned|gathered)\*?\}/g, '')
    .replace(/\\&/g, '@AMP@')
    .replace(/&/g, '')
    .replace(/@AMP@/g, '\\&')
}

/** 수식 TeX → 행 목록 (\\ 줄바꿈과 최상위 = 모두 분할점) */
function texToRows(tex: string): string[] {
  return tex
    .split(/\\\\/)
    .flatMap(splitTopEquals)
    .filter((s) => s.trim())
}

/**
 * 등식 체인 — 실제 컨테이너 폭을 재서 그리디로 줄을 정한다.
 *
 * · 전체가 한 줄에 들어가면 그대로 한 줄 (쪼개지 않음)
 * · 안 들어가면: 첫 줄은 "첫 세그먼트 (+ 첫 = 세그먼트가 같이 들어가면 붙임)",
 *   이후 = 세그먼트는 각각 다음 줄 — aligned 블록으로 = 열 맞춤
 * · 컨테이너 폭 변화(500↔350·디바이스 토글)에 ResizeObserver 로 재배치
 * · 한 행이 그래도 넘치면 BlockMath 의 자동 축소가 마무리
 */
function EquationChain({
  segs,
  tail,
  fromBlock,
}: {
  segs: string[]
  tail: string
  fromBlock: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [plan, setPlan] = useState<{ single: boolean; rows: string[] } | null>(null)

  // 폭 실측용 — 각 세그먼트를 실제 렌더와 동일하게 그려둔 숨김 노드
  const segHtmls = useMemo(() => segs.map((s) => renderInlineHtml(s)), [segs])

  useLayoutEffect(() => {
    const host = hostRef.current
    const meas = measureRef.current
    if (!host || !meas) return
    const compute = () => {
      const limit = host.clientWidth
      if (!limit) return
      const spans = Array.from(meas.children) as HTMLElement[]
      const widths = spans.map((s) => s.getBoundingClientRect().width)
      const gap = 8 // 세그먼트 사이 시각 간격 여유
      const total = widths.reduce((a, b) => a + b + gap, 0)
      if (total <= limit) {
        setPlan({ single: true, rows: [] })
        return
      }
      // 첫 줄: 첫 세그먼트 + 첫 = 세그먼트가 함께 들어가면 붙임 (해설지 관례)
      const rows: string[] = []
      if (segs.length >= 2 && widths[0] + widths[1] + gap <= limit) {
        rows.push(`${segs[0]} ${segs[1]}`)
        for (let k = 2; k < segs.length; k++) rows.push(segs[k])
      } else {
        rows.push(...segs)
      }
      setPlan({ single: false, rows })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(host)
    return () => ro.disconnect()
  }, [segs, segHtmls])

  return (
    <div ref={hostRef} className="exam-explain-line">
      {/* 실측 노드 — 화면에 보이지 않지만 폰트 컨텍스트는 동일 */}
      <div ref={measureRef} className="exam-measure" aria-hidden>
        {segHtmls.map((h, i) => (
          <span key={i} dangerouslySetInnerHTML={{ __html: h }} />
        ))}
      </div>
      {plan === null ? null : plan.single ? (
        fromBlock ? (
          <KatexText text={`$$${segs.join(' ')}$$`} />
        ) : (
          <>
            <KatexText text={`$${segs.join(' ')}$`} />
            {tail.trim() && <ExamText text={tail} />}
          </>
        )
      ) : (
        <KatexText text={`$$${toAlignedTex(plan.rows)}$$`} />
      )}
      {plan !== null && (plan.single ? fromBlock : true) && tail.trim() ? (
        <div className="exam-explain-line">
          <ExamText text={tail.trim()} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * 문단 하나 렌더 — 줄 단위 분리 + 등식 체인 병합.
 * "= …" 로 시작하는 수식 줄은 앞 수식 줄에 이어붙여 하나의 aligned 블록으로.
 */
function ExplainPara({ para }: { para: string }) {
  // 여러 줄에 걸친 $$…$$ 블록을 한 줄로 접어 독립시킨다 — 줄 단위 분해가
  // 블록을 못 알아보고 원문을 노출하는 것 방지 (\begin{aligned} 멀티라인 등).
  // ★ $$ 블록을 먼저 자리표시자로 빼놓은 뒤 홑 $ 를 접어야 한다 — 안 그러면
  //   홑 $ 접기가 한 블록의 닫는 $와 다음 블록의 여는 $를 짝으로 오인해
  //   블록 사이 한글 문장까지 수식으로 삼킨다
  const savedBlocks: string[] = []
  const normalized = para
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, inner: string) => {
      savedBlocks.push(`\n$$${inner.replace(/\s*\n\s*/g, ' ').trim()}$$\n`)
      return `@@EXBLOCK${savedBlocks.length - 1}@@`
    })
    // 홑 $ 한 쌍이 여러 줄에 걸친 경우($\n\begin{aligned}…\n$)도 접는다
    // — 환경이 들어있으면 display($$)로 승격
    .replace(/\$([^$]*\n[^$]*)\$/g, (_, inner: string) => {
      const folded = inner.replace(/\s*\n\s*/g, ' ').trim()
      return /\\begin\{/.test(folded) ? `\n$$${folded}$$\n` : `$${folded}$`
    })
    .replace(/@@EXBLOCK(\d+)@@/g, (_, n: string) => savedBlocks[Number(n)])
  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  // 영역(exam-explain-p) 그룹 — $$ 가운데 식(+이어지는 꼬리) 뒤에서 영역을 끊는다
  const groups: ReactNode[][] = []
  let nodes: ReactNode[] = []
  const breakArea = () => {
    if (nodes.length) {
      groups.push(nodes)
      nodes = []
    }
  }
  // $$ 식에 이어지는 줄 판정 — 자격이 유지되는 동안 개수 제한 없이 묶는다:
  // · "(단,$C$는 적분상수)" · "이다." · "$\cdots$㉠" 같은 짧은 꼬리
  // · "$a = 0$" 같은 짧은 결과식 (인라인 수식 줄 — 식 아래 왼쪽에 붙음)
  const isConnector = (ln: string | undefined): ln is string => {
    if (!ln || ln.length > 30 || PARA_START.test(ln)) return false
    const mm = matchMathOnly(ln)
    return mm ? !mm.isBlock : true
  }
  let i = 0
  let key = 0
  while (i < lines.length) {
    const m = matchMathOnly(lines[i])
    if (m && /\\begin\{/.test(m.tex)) {
      if (/\\begin\{(aligned|gathered)\*?\}/.test(m.tex) && !/\\begin\{(?!aligned|gathered)/.test(m.tex)) {
        // aligned·gathered 는 행으로 해체해 폭 실측 그리디 재배치 —
        // 첫 행 A = B 조차 안 들어가면 A / = B 로 접는다 (스크롤 금지)
        let rows = texToRows(unwrapAlignEnv(m.tex))
        if (rows.length >= 2) {
          // 환경 블록 뒤로 이어지는 "$$= …$$"·"$= …$" 줄도 같은 등식 체인 —
          // 데이터가 한 등식을 여러 블록으로 쪼갠 경우 병합 (꼬리 나오면 종료)
          let tail = m.tail
          let j = i + 1
          while (j < lines.length && !tail.trim()) {
            const n = matchMathOnly(lines[j])
            if (!n || /\\begin\{/.test(n.tex)) break
            const nRows = texToRows(n.tex)
            if (!nRows.length || !nRows[0].startsWith('=')) break
            rows = rows.concat(nRows)
            tail = n.tail
            j++
          }
          nodes.push(<EquationChain key={key++} segs={rows} tail={tail} fromBlock />)
          i = j
          while (isConnector(lines[i])) {
            nodes.push(
              <div key={key++} className="exam-explain-line">
                <ExamText text={lines[i]} />
              </div>,
            )
            i++
          }
          breakArea()
          continue
        }
      }
      // 그 외 환경(array 증감표·cases 등)은 구조 보존 — 행간만 주입
      const spaced = m.tex.replace(/\\\\(?!\[)/g, '\\\\[10pt]')
      nodes.push(
        <div key={key++} className="exam-explain-line">
          <KatexText text={`$$${spaced}$$`} />
        </div>,
      )
      if (m.tail.trim())
        nodes.push(
          <div key={key++} className="exam-explain-line">
            <ExamText text={m.tail.trim()} />
          </div>,
        )
      i++
      while (isConnector(lines[i])) {
        nodes.push(
          <div key={key++} className="exam-explain-line">
            <ExamText text={lines[i]} />
          </div>,
        )
        i++
      }
      breakArea()
      continue
    }
    if (m) {
      let rows = texToRows(m.tex)
      let tail = m.tail
      let merged = 1
      let j = i + 1
      // 다음 줄이 "= …" 수식이면 같은 등식 체인 — 꼬리(이다 등)가 나오면 문장 종료
      while (j < lines.length && !tail.trim()) {
        const n = matchMathOnly(lines[j])
        if (!n || /\\begin\{/.test(n.tex)) break
        const nRows = texToRows(n.tex)
        if (!nRows.length || !nRows[0].startsWith('=')) break
        rows = rows.concat(nRows)
        tail = n.tail
        merged++
        j++
      }
      // = 세그먼트 2개 이상 → 실측 기반 그리디 줄바꿈 (들어가면 한 줄 그대로)
      if (rows.length >= 2) {
        nodes.push(<EquationChain key={key++} segs={rows} tail={tail} fromBlock={m.isBlock} />)
        i = j
        if (m.isBlock) {
          while (isConnector(lines[i])) {
            nodes.push(
              <div key={key++} className="exam-explain-line">
                <ExamText text={lines[i]} />
              </div>,
            )
            i++
          }
          breakArea()
        }
        continue
      }
      // = 없는 단일 수식 줄 — $$ 는 display 유지, $ 는 문장 줄
      nodes.push(
        <div key={key++} className="exam-explain-line">
          {m.isBlock ? (
            <>
              <KatexText text={`$$${m.tex}$$`} />
              {m.tail.trim() && <ExamText text={m.tail.trim()} />}
            </>
          ) : (
            <ExamText text={lines[i]} />
          )}
        </div>,
      )
      i++
      if (m.isBlock) {
        while (isConnector(lines[i])) {
          nodes.push(
            <div key={key++} className="exam-explain-line">
              <ExamText text={lines[i]} />
            </div>,
          )
          i++
        }
        breakArea()
      }
      continue
    }
    // 문장 끝에 긴 = 체인 수식이 붙은 줄 — 수식을 떼어 그리디 줄바꿈으로.
    // 안 떼면 좁은 폭에서 인라인 수식이 자체 줄바꿈되며 분수끼리 뭉갠다
    const tailMath = lines[i].match(/^(.*\S)\s*\$([^$]+)\$([가-힣.,·()!?\s]{0,10})$/)
    if (tailMath) {
      const chainTex = tailMath[2]
      const rows = texToRows(chainTex)
      if (rows.length >= 3 || (rows.length === 2 && chainTex.length > 60)) {
        nodes.push(
          <div key={key++} className="exam-explain-line">
            <ExamText text={tailMath[1]} />
          </div>,
        )
        nodes.push(
          <EquationChain key={key++} segs={rows} tail={tailMath[3] ?? ''} fromBlock={false} />,
        )
        i++
        continue
      }
    }
    // 일반 문장 줄
    nodes.push(
      <div key={key++} className="exam-explain-line">
        <ExamText text={lines[i]} />
      </div>,
    )
    i++
  }
  breakArea()
  return (
    <>
      {groups.map((g, gi) => (
        <div key={gi} className="exam-explain-p">
          {g}
        </div>
      ))}
    </>
  )
}

/** 증감표 등 마크다운 표 렌더 */
function ExamTable({ rows }: { rows: string[][] }) {
  return (
    <div className="exam-table-wrap">
      <table className="exam-table">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                /* exam-cell — 어드민 전역 td 규칙(.admin-root tbody td:last-child
                   우측 정렬 등)보다 우선순위를 확보하는 훅 */
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

/**
 * 마크다운 파이프 표 블록 분리 — 연속된 `| ... |` 줄 묶음(정렬 구분줄 :---: 포함)을
 * 표로, 나머지는 텍스트로. 표 앞뒤 개행은 표 마진이 간격을 담당하므로 흡수.
 */
function splitMarkdownTables(text: string): Array<{ text?: string; rows?: string[][] }> {
  const lines = text.split('\n')
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
  const isSep = (l: string) => /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/.test(l)
  const blocks: Array<{ text?: string; rows?: string[][] }> = []
  let buf: string[] = []
  let i = 0
  const flushText = () => {
    if (buf.length) {
      blocks.push({ text: buf.join('\n').replace(/\n+$/, '') })
      buf = []
    }
  }
  while (i < lines.length) {
    if (isRow(lines[i])) {
      // 표 후보: 연속 row 줄 수집 — 구분줄이 포함될 때만 표로 확정
      let j = i
      const rowLines: string[] = []
      while (j < lines.length && isRow(lines[j])) {
        rowLines.push(lines[j])
        j++
      }
      if (rowLines.length >= 2 && rowLines.some(isSep)) {
        flushText()
        const rows = rowLines
          .filter((l) => !isSep(l))
          .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
        blocks.push({ rows })
        // 표 다음의 빈 줄 흡수
        while (j < lines.length && lines[j].trim() === '') j++
        i = j
        continue
      }
    }
    buf.push(lines[i])
    i++
  }
  flushText()
  return blocks
}

/**
 * 박스 내용 렌더 — (가)(나)(다) 조건 항목을 나눠 항목 사이에만 간격을 준다.
 * (한 조건이 길어 줄바꿈될 때는 일반 줄간격 유지 · 조건 마커가 없으면 그대로)
 */
function BoxContent({ text }: { text: string }) {
  const items = text.split(/\n(?=\s*\([가-힣]\))/)
  if (items.length <= 1) return <UnderlinedText text={text} />
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="pv-box-item">
          <UnderlinedText text={item.replace(/^\n+/, '')} />
        </div>
      ))}
    </>
  )
}

/** <u>...</u> 구간을 실제 밑줄로 변환하고, 나머지는 KatexText 로 넘긴다 */
function UnderlinedText({ text }: { text: string }) {
  if (!text) return null
  const parts: ReactNode[] = []
  const pattern = /<u>([\s\S]*?)<\/u>/g
  let cursor = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(<KatexText key={key++} text={text.slice(cursor, match.index)} />)
    }
    // 짧은 밑줄 구간(1~2단어)만 한 덩어리로 묶어 내부 공백 늘어남·줄바꿈을 막는다.
    // 기준을 넉넉히 잡으면 구 전체가 다음 줄로 밀리며 윗줄이 확 벌어지므로 25자로 제한.
    // 긴 구·문장 밑줄은 수능 지면처럼 정상 줄바꿈 (밑줄은 줄마다 이어짐).
    const compact = match[1].length <= 25
    parts.push(
      <u
        key={key++}
        style={{
          // 수능 지면 밑줄: g·p 꼬리에서 끊기지 않는 연속선을 꼬리 아래에 긋는다
          textDecorationSkipInk: 'none',
          textUnderlineOffset: 4,
          textDecorationThickness: 1,
          ...(compact ? { display: 'inline-block' } : {}),
        }}
      >
        <KatexText text={match[1]} />
      </u>,
    )
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) {
    parts.push(<KatexText key={key++} text={text.slice(cursor)} />)
  }
  return <Fragment>{parts}</Fragment>
}
