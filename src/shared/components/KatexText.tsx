import { useMemo } from 'react'
import katex from 'katex'

/**
 * 수식 인라인/블록 렌더링.
 * 텍스트 안에서 `$...$` = 인라인, `$$...$$` = 블록 으로 표시.
 * 예: "log₂ 8 의 값" · "$\\log_2 8$ 의 값" · "$$g(x) = f(x)+1$$"
 */

/** 세로로 큰 인라인 수식(분수·적분·시그마 등) — 포함된 줄에 위아래 여백이 필요 */
const TALL_MATH = /\\[dct]?frac|\\int|\\o?i+nt|\\sum|\\prod|\\binom|\\begin\{|\\displaystyle|\\overset|\\underset|\\stackrel/

/**
 * 합집합(∪)·교집합(∩) 확대 — 수능 지면은 대문자 높이로 크게 조판한다.
 * \mathbin 으로 감싸 이항 연산자 간격은 유지. (\bigcup·\bigcap 은 매칭 안 됨)
 */
const enlargeSetOps = (tex: string) => tex.replace(/\\(cup|cap)\b/g, '\\mathbin{\\large\\$1}')

/**
 * 절댓값(|)·대괄호([ ]) 획 보강 — KaTeX 기본이 수능 지면보다 가늘어 볼드 글리프로 교체.
 * 렌더된 HTML 의 단일 글리프 텍스트 노드만 감싸므로 다른 기호에는 영향 없음.
 */
const emboldenDelims = (html: string) =>
  html.replace(/>([[\]∣|])</g, '><span class="katex-delim-bold">$1</span><')

/**
 * 인라인 수식의 분수를 지면 크기로 — KaTeX 는 문장 속 \frac 을 축소형(textstyle)으로
 * 그리는데, 수능 해설지는 문장 안 분수도 큰 형태라 \dfrac 으로 승격.
 * (\dfrac 이 이미 쓰인 곳은 매칭되지 않아 그대로)
 */
const displaySizeFractions = (tex: string) => tex.replace(/\\frac\b/g, '\\dfrac')
export function KatexText({ text }: { text: string }) {
  const parts = useMemo(() => parse(text), [text])
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
        const source =
          p.type === 'inline'
            ? displaySizeFractions(enlargeSetOps(p.value))
            : enlargeSetOps(p.value)
        const html = emboldenDelims(
          katex.renderToString(source, {
            throwOnError: false,
            displayMode: p.type === 'block',
          }),
        )
        // 블록 수식은 KaTeX 가 한 덩어리로 렌더 → 폭 좁으면 넘침
        // overflow-x-auto 로 자체 스크롤 컨테이너 만들어 넘침 방지 · 사용자는 좌우 스크롤로 확인
        return (
          <span
            key={i}
            className={
              p.type === 'block'
                ? 'katex-block block my-md overflow-x-auto text-center'
                : TALL_MATH.test(p.value)
                  ? // 큰 수식이 든 줄만 위아래 간격 확보 — tailwind .inline(display:inline)과
                    // 충돌하면 패딩이 줄 높이에 반영되지 않으므로 katex-tall 단독 사용
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

interface Part {
  type: 'text' | 'inline' | 'block'
  value: string
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
  return parts
}
