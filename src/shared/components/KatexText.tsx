import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'

/**
 * 수식 인라인/블록 렌더링.
 * 텍스트 안에서 `$...$` = 인라인, `$$...$$` = 블록(가운데 정렬 display) 으로 표시.
 * 예: "log₂ 8 의 값" · "$\\log_2 8$ 의 값" · "$$g(x) = f(x)+1$$"
 *
 * 해설 조판은 파이썬 렌더러(pullit-review-note render_md)와 동일 규칙 —
 * 블록 수식은 원본 그대로 가운데 정렬, 문단 구성은 ExamText.MathExplainLayout 담당.
 */

/** 세로로 큰 인라인 수식(분수·적분·시그마·근호·극한 등) — 포함된 줄에 위아래 여백이 필요 */
const TALL_MATH = /\\[dct]?frac|\\int|\\o?i+nt|\\sum|\\prod|\\binom|\\begin\{|\\displaystyle|\\overset|\\underset|\\stackrel|\\sqrt|\\lim|\\overline/

/**
 * 합집합(∪)·교집합(∩) 확대 — 수능 지면은 대문자 높이로 크게 조판한다.
 * \mathbin 으로 감싸 이항 연산자 간격은 유지. (\bigcup·\bigcap 은 매칭 안 됨)
 */
const enlargeSetOps = (tex: string) => tex.replace(/\\(cup|cap)\b/g, '\\mathbin{\\large\\$1}')

/**
 * 절댓값(|)·대괄호([ ]) 획 보강 — KaTeX 기본이 수능 지면보다 가늘어 볼드 글리프로 교체.
 * KaTeX 가 이웃 글리프를 한 span 으로 합치는 경우("2∣" 등)에도 놓치지 않도록
 * 텍스트 노드 안의 막대·대괄호를 개별로 감싼다 (태그 속성은 >…< 밖이라 안전).
 */
const emboldenDelims = (html: string) => {
  // 시각 렌더 파트(katex-html)에만 적용 — 앞쪽 MathML/annotation(원본 TeX
  // 보존·접근성)까지 감싸면 복사·스크린리더가 오염된다
  const idx = html.indexOf('class="katex-html"')
  if (idx === -1) return html
  return (
    html.slice(0, idx) +
    html
      .slice(idx)
      .replace(/>([^<]*[∣|[\]][^<]*)</g, (_, text: string) =>
        `>${text.replace(/([∣|[\]])/g, '<span class="katex-delim-bold">$1</span>')}<`,
      )
  )
}

/**
 * 인라인 수식의 분수를 지면 크기로 — KaTeX 는 문장 속 \frac 을 축소형(textstyle)으로
 * 그리는데, 수능 지면은 문장 안 분수도 큰 형태라 \dfrac 으로 승격.
 * 지수·아래첨자(^·_) 안의 분수는 \\tfrac 으로 — 기본은 너무 작고 \\dfrac 은 거대.
 */
const displaySizeFractions = (tex: string): string => {
  let out = ''
  let i = 0
  let depth = 0
  const scriptDepths: number[] = [] // ^{…}·_{…} 그룹이 열린 brace 깊이 스택
  while (i < tex.length) {
    const c = tex[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      while (scriptDepths.length && depth < scriptDepths[scriptDepths.length - 1]) {
        scriptDepths.pop()
      }
    } else if (c === '^' || c === '_') {
      let k = i + 1
      while (tex[k] === ' ') k++
      if (tex[k] === '{') scriptDepths.push(depth + 1)
    }
    if (tex.startsWith('\\frac', i) && !/[a-zA-Z]/.test(tex[i + 5] ?? '')) {
      // 스크립트 그룹 안이거나, ^·_ 바로 뒤(중괄호 없는 형태)면 승격하지 않음
      let k = out.length - 1
      while (k >= 0 && out[k] === ' ') k--
      const inScript = scriptDepths.length > 0 || out[k] === '^' || out[k] === '_'
      // 지수 속 분수: 기본(\frac)은 깨알 크기, \dfrac 은 거대 → \tfrac(텍스트
      // 크기 고정)으로 한 단계만 키워 수능 지면과 비슷한 가독성 확보
      out += inScript ? '\\tfrac' : '\\dfrac'
      i += 5
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * KaTeX 렌더 + 파싱 실패 폴백.
 * 데이터에 \left{ … \right} 가 aligned 행(\\)을 가로지르는 비표준 TeX 가 있어
 * (MathJax 는 허용·KaTeX 는 거부) 실패 시 \left·\right 를 벗겨 재시도한다 —
 * 구분자 크기만 고정될 뿐 수식 내용은 동일.
 */
const renderWithFallback = (tex: string, displayMode: boolean) => {
  const render = (t: string) => katex.renderToString(t, { throwOnError: false, displayMode })
  let html = render(tex)
  if (html.includes('katex-error')) {
    // 1차: \left·\right 가 aligned 행(\\)을 가로지르는 비표준 구조 해체
    html = render(tex.replace(/\\left\b\s*/g, '').replace(/\\right\b\s*/g, ''))
  }
  if (html.includes('katex-error')) {
    // 2차: 수식 안의 $ (array 증감표 셀 $x$ 등 — 수식 모드에서 $ 는 문법 위반이나
    // MathJax 는 관대해 데이터에 섞여 있음) 및 끝에 남은 홑 백슬래시 제거
    html = render(
      tex
        .replace(/\\left\b\s*/g, '')
        .replace(/\\right\b\s*/g, '')
        .replace(/\$/g, '')
        .replace(/\\+\s*$/, ''),
    )
  }
  return html
}

/**
 * 괄호 그룹 하나를 통째로 묶을 수 있는 최대 길이(TeX 문자 수).
 * 이보다 길면 묶지 않는다 — 통짜로 두면 접을 자리가 없어 화면을 넘치는데,
 * 그 경우엔 그룹 안에서라도 접히는 편이 낫다.
 */
const MAX_PROTECTED_GROUP = 80

/** open 위치의 ( 에 대응하는 ) 의 다음 인덱스 (짝이 없으면 -1) */
const matchParen = (tex: string, open: number): number => {
  let depth = 0
  for (let i = open; i < tex.length; i++) {
    const c = tex[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}

/**
 * 괄호 그룹을 {…} 로 묶어 **안에서 접히지 않게** 한다.
 * KaTeX 는 괄호 안 이항연산자에도 base 를 끊어 두기 때문에, 그냥 두면
 * "(2cos∠ABC +⏎1)(38cos∠ABC−37)" 처럼 묶음 한가운데서 줄이 갈라진다.
 * 중괄호 그룹은 base 1개로 렌더되므로 그룹 사이(최상위 연산자)에서만 접힌다.
 */
const protectParenGroups = (tex: string): string => {
  let out = ''
  let braceDepth = 0
  let i = 0
  while (i < tex.length) {
    const ch = tex[i]
    if (ch === '\\') {
      // \left( 는 \right) 와 짝이라 \left 부터 감싸야 구조가 깨지지 않는다.
      // 구분자가 소괄호인 경우만 — \left\{ · \left| 등을 괄호로 오인하면
      // 엉뚱한 위치에서 짝을 찾아 TeX 구조가 깨진다
      const left = /^\\left\s*\(/.exec(tex.slice(i))
      if (left) {
        const end = braceDepth === 0 ? matchParen(tex, i + left[0].length - 1) : -1
        if (end > 0 && end - i <= MAX_PROTECTED_GROUP) {
          out += `{${tex.slice(i, end)}}`
          i = end
          continue
        }
        // 묶지 않기로 했으면 \left( 를 통째로 흘려보낸다 — 여기서 2글자만
        // 소비하면 뒤따르는 ( 를 일반 괄호로 오인해 "\left{(" 로 깨진다
        out += left[0]
        i += left[0].length
        continue
      }
      out += ch + (tex[i + 1] ?? '')
      i += 2
      continue
    }
    if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth--
    if (ch === '(' && braceDepth === 0) {
      const end = matchParen(tex, i)
      if (end > 0 && end - i <= MAX_PROTECTED_GROUP) {
        out += `{${tex.slice(i, end)}}`
        i = end
        continue
      }
    }
    out += ch
    i++
  }
  return out
}

/**
 * 쉼표 뒤 줄바꿈 지점 삽입 — 쉼표로만 이어진 나열("(3,2,2),(4,3,2),…")은
 * 통짜 base 1개라 접히지 않는다. 괄호·중괄호 **밖**의 쉼표 뒤에만 넣는다.
 */
const addCommaBreaks = (tex: string): string => {
  let out = ''
  let depth = 0
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i]
    if (ch === '\\') {
      out += ch + (tex[i + 1] ?? '')
      i++
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    out += ch
    if (ch === ',' && depth <= 0) out += '\\allowbreak '
  }
  return out
}

/**
 * wrap 모드 전처리 — 접을 자리를 "묶음 사이"에만 만든다.
 * 괄호 보호를 먼저 하므로, 뒤이은 쉼표 처리는 그룹 안 쉼표를 건드리지 않는다.
 */
const addBreakPoints = (tex: string): string => addCommaBreaks(protectParenGroups(tex))

/** 인라인 수식 1개 → HTML (폭 실측용으로도 사용 — 실제 렌더와 동일 처리) */
export const renderInlineHtml = (tex: string) =>
  emboldenDelims(renderWithFallback(displaySizeFractions(enlargeSetOps(tex)), false))

interface Part {
  type: 'text' | 'inline' | 'block'
  value: string
}

interface KatexTextProps {
  text: string
  /**
   * 폭이 모자랄 때 **축소 대신 줄바꿈**으로 맞춘다 (기본 false = 기존 자동 축소).
   * 해설처럼 "수식 크기가 화면 전체에서 균일" 해야 하는 곳에서 켠다 —
   * display 자동 축소를 끄고, 끊을 자리가 없는 나열에는 \allowbreak 을 넣는다.
   */
  wrap?: boolean
}

export function KatexText({ text, wrap = false }: KatexTextProps) {
  const parts = useMemo(() => parse(text), [text])

  // 줄 전체가 수식 하나로 된 줄은 크기와 무관하게 위아래 간격 필요 — 개행/블록
  // 인접 여부로 판별. "$수식$이다." 처럼 짧은 한글 꼬리(≤8자)가 붙은 줄도 같은
  // 취급. 개행 문맥이 없는 단독 수식(선택지 값)은 제외해 원기호 정렬 유지
  const isOwnLine = (i: number) => {
    const prev = parts[i - 1]
    const next = parts[i + 1]
    const prevNl =
      (prev?.type === 'text' && /\n[ \t]*$/.test(prev.value)) || prev?.type === 'block'
    const nextNl =
      (next?.type === 'text' && /^[가-힣.,·()!?\s]{0,8}\n/.test(next.value)) ||
      next?.type === 'block'
    const nextLastTail =
      next?.type === 'text' &&
      i + 1 === parts.length - 1 &&
      /^[가-힣.,·()!?\s]{0,8}$/.test(next.value)
    return (prevNl || !prev) && (nextNl || nextLastTail || !next) && (prevNl || nextNl)
  }

  return (
    <span>
      {parts.map((p, i) => {
        if (p.type === 'text') {
          return (
            <span key={i} style={{ whiteSpace: 'pre-wrap' }}>
              {p.value}
            </span>
          )
        }
        if (p.type === 'block') {
          return <BlockMath key={i} tex={p.value} wrap={wrap} />
        }
        const html = renderInlineHtml(wrap ? addBreakPoints(p.value) : p.value)
        return (
          <span
            key={i}
            className={
              TALL_MATH.test(p.value) || isOwnLine(i)
                ? // 큰 수식이 든 줄·수식 단독 줄만 위아래 간격 확보 — tailwind
                  // .inline(display:inline)과 충돌하면 패딩이 줄 높이에 반영되지
                  // 않으므로 katex-tall 단독 사용
                  'katex-tall'
                : 'inline'
            }
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </span>
  )
}

/**
 * display 블록 수식 — 컨테이너(350~500px)보다 넓으면 폰트를 자동 축소해
 * 가로 스크롤 없이 딱 맞춘다 (최소 0.7배 · 그 밑으로는 스크롤 폴백).
 * 컨테이너 폭 변화(디바이스 토글·패드 드래그)에도 ResizeObserver 로 재계산.
 */
function BlockMath({ tex, wrap = false }: { tex: string; wrap?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const scaleRef = useRef(1)
  const [scale, setScale] = useState(1)

  const html = useMemo(
    // displaySizeFractions: 블록 본문 분수는 이미 display 크기라 영향 없고,
    // 지수·첨자 속 분수만 \tfrac 으로 키워진다 (깨알 크기 방지)
    () =>
      emboldenDelims(
        renderWithFallback(
          displaySizeFractions(enlargeSetOps(wrap ? addBreakPoints(tex) : tex)),
          true,
        ),
      ),
    [tex, wrap],
  )

  useLayoutEffect(() => {
    scaleRef.current = 1
    setScale(1)
  }, [html])

  useLayoutEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || wrap) return  // wrap 모드는 축소하지 않는다 — 크기 균일 유지
    const measure = () => {
      const container = el.clientWidth
      if (!container) return
      // 실제 수식 콘텐츠 폭을 매번 실측 — base 가 콘텐츠 크기(min-content)를
      // 갖는 유일한 노드 (.katex-display/.katex 는 블록이라 컨테이너 폭과 같고,
      // scrollWidth 는 컨테이너 폭 아래로 안 내려가 축소 후 복귀 불가)
      // KaTeX 0.18 부터 클래스가 .katex-base 로 바뀌어 둘 다 잡는다
      const bases = el.querySelectorAll<HTMLElement>('.katex-base, .base')
      const contentWidth = bases.length
        ? Math.max(...Array.from(bases, (b) => b.getBoundingClientRect().width))
        : el.scrollWidth
      const natural = contentWidth / scaleRef.current
      const needed = container / natural
      const next = needed >= 1 ? 1 : Math.max(0.7, needed * 0.98)
      if (Math.abs(next - scaleRef.current) > 0.02) setScale(next)
    }
    measure()
    // KaTeX 웹폰트 로드가 끝나면 글리프 폭이 바뀌므로 재측정
    document.fonts?.ready.then(measure).catch(() => {})
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [html, scale, wrap])

  return (
    <span
      ref={ref}
      className="katex-block block my-md overflow-x-auto text-center"
      style={!wrap && scale < 1 ? { fontSize: `${scale}em` } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function parse(text: string): Part[] {
  const parts: Part[] = []
  let buffer = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] === '$') {
      if (buffer) {
        parts.push({ type: 'text', value: buffer })
        buffer = ''
      }
      const end = text.indexOf('$$', i + 2)
      if (end === -1) {
        buffer += text.slice(i)
        break
      }
      parts.push({ type: 'block', value: text.slice(i + 2, end) })
      i = end + 2
      continue
    }
    if (text[i] === '$') {
      if (buffer) {
        parts.push({ type: 'text', value: buffer })
        buffer = ''
      }
      const end = text.indexOf('$', i + 1)
      if (end === -1) {
        buffer += text.slice(i)
        break
      }
      parts.push({ type: 'inline', value: text.slice(i + 1, end) })
      i = end + 1
      continue
    }
    buffer += text[i]
    i++
  }
  if (buffer) parts.push({ type: 'text', value: buffer })

  // 블록 수식($$...$$) 앞뒤의 개행 제거 — pre-wrap 이 개행을 빈 줄로 살리는데
  // 블록 자체 마진과 겹치면 수식 위아래에 큰 공백이 생긴다 (수능 지면 간격 유지)
  for (let j = 0; j < parts.length; j++) {
    if (parts[j].type !== 'block') continue
    const prev = parts[j - 1]
    if (prev?.type === 'text') prev.value = prev.value.replace(/[ \t]*\n+[ \t]*$/, '')
    const next = parts[j + 1]
    if (next?.type === 'text') next.value = next.value.replace(/^[ \t]*\n+[ \t]*/, '')
  }
  // 개행 제거로 빈 문자열이 된 텍스트 조각 제거 — 인접 판정 어긋남 방지
  const filtered = parts.filter((p) => p.type !== 'text' || p.value !== '')

  // 함수 인자·조건 주석이 별도 수식으로 갈라진 데이터 병합 —
  // "$\lim … f$ $(x) = 0$" · "$a$ $(a > 1)$" 처럼 공백만 사이에 둔 인접
  // 인라인 수식은 그 공백이 줄바꿈 지점이 되어 좁은 화면에서 "f / (x)=0" 으로
  // 갈라진다. 뒤 조각이 여는 괄호로 시작하는 짧은 수식이면 한 수식으로 잇는다
  // (긴 수식은 제외 — 통짜가 되면 접을 자리가 없어 화면을 넘친다).
  for (let j = 0; j < filtered.length - 2; j++) {
    const a = filtered[j]
    const gap = filtered[j + 1]
    const b = filtered[j + 2]
    if (
      a.type === 'inline' &&
      b.type === 'inline' &&
      gap.type === 'text' &&
      /^[ \t]+$/.test(gap.value) && // 공백뿐 (개행 없음 = 원문 같은 줄)
      b.value.trimStart().startsWith('(') &&
      b.value.length <= 40
    ) {
      a.value = `${a.value} \\, ${b.value}`
      filtered.splice(j + 1, 2)
      j--
    }
  }
  return filtered
}
