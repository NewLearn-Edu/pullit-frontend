import { useEffect, useMemo, useRef } from 'react'
import './exam-mathjax.css'

/**
 * 검수 도구(AI 개발자 파이썬 렌더러) 방식 그대로의 해설 렌더러 — 비교/검증용.
 *
 * · HTML 조립 규칙: pullit-review-note render_core.render_md 를 1:1 포팅
 *   (빈 줄=문단 <p>, 줄바꿈=<br>, $$…$$=가운데 display 블록, `백틱`=조건 박스,
 *    **볼드**, <u>밑줄</u> 보존, \frac→\dfrac 승격)
 * · 수식 엔진: MathJax (CDN 지연 로드) — 관대한 파서 + 자동 줄바꿈(v4)
 * · CSS: layout.py 의 해설 관련 스타일 포팅 (exam-mathjax.css)
 */

/* ── MathJax 지연 로더 (한 번만) ─────────────────────────────── */

declare global {
  interface Window {
    MathJax?: any
  }
}

let mjLoading: Promise<void> | null = null

function loadMathJax(): Promise<void> {
  if (window.MathJax?.typesetPromise) return Promise.resolve()
  if (mjLoading) return mjLoading
  mjLoading = new Promise<void>((resolve) => {
    // 파이썬 렌더러(_MATHJAX_CDN)와 동일한 설정 + v4 줄바꿈 옵션
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
        processEnvironments: true,
        packages: { '[+]': ['ams'] },
      },
      chtml: {
        displayAlign: 'center',
        // v4: 넓은 display 블록은 줄바꿈(linebreak) 대신 통째로 비율 축소 —
        // aligned 등식 체인을 linebreak 가 계단식으로 재배치해 좌우 스크롤을
        // 만드는 문제 회피 (좌우 무스크롤 원칙)
        displayOverflow: 'scale',
        linebreaks: { inline: true },
      },
      output: { linebreaks: { inline: true } },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'] },
      startup: { typeset: false },
    }
    const tryLoad = (src: string, fallback?: string) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => {
        const ready = window.MathJax?.startup?.promise
        if (ready?.then) ready.then(() => resolve())
        else resolve()
      }
      s.onerror = () => {
        s.remove()
        if (fallback) tryLoad(fallback)
        else resolve() // 로드 실패 시 원문 노출 (렌더는 포기)
      }
      document.head.appendChild(s)
    }
    // v4(자동 줄바꿈) 우선, 없으면 검수 도구와 동일한 v3 로 폴백
    tryLoad(
      'https://cdn.jsdelivr.net/npm/mathjax@4/tex-chtml.js',
      'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js',
    )
  })
  return mjLoading
}

/* ── 파이썬 render_md 1:1 포팅 ───────────────────────────────── */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** (?<!d)\frac → \dfrac — 파이썬 promote_frac_to_dfrac 과 동일 */
const promoteFrac = (s: string) => s.replace(/\\frac\b/g, '\\dfrac')

/** 인라인 수식을 보존하며 나머지 텍스트를 escape — _render_plain_text_with_inline_math */
function renderPlainWithInlineMath(text: string): string {
  const saved: string[] = []
  let s = text
    .replace(/\\\([\s\S]*?\\\)/g, (m) => {
      saved.push(promoteFrac(m))
      return `@@MJINLINE${saved.length - 1}@@`
    })
    .replace(/\$(?!\$)([^$]+)\$(?!\$)/g, (m) => {
      saved.push(promoteFrac(m))
      return `@@MJINLINE${saved.length - 1}@@`
    })
  s = escapeHtml(s)
  // <u>밑줄</u> 보존 (파이썬 보강판과 동일)
  s = s.replace(/&lt;u&gt;/g, '<u>').replace(/&lt;\/u&gt;/g, '</u>')
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
  saved.forEach((m, i) => {
    s = s.replace(`@@MJINLINE${i}@@`, m)
  })
  return s
}

/** 중괄호 깊이 0 에서 처음 나오는 = 위치 — 첨자 속 =(_{x=2} 등)는 건너뜀 */
function firstTopLevelEq(s: string): number {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') i++ // \{ \} \\ 등 이스케이프는 그룹 깊이와 무관
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '=' && depth === 0) return i
  }
  return -1
}

/** display 블록/문단 조립 — _render_md_no_backtick
 *  + 등식 체인 병합(우리 확장): "= 로 시작하는 $$ 블록"이 연달아 오면
 *    구 KaTeX 조판처럼 하나의 aligned 로 묶어 = 를 세로 정렬한다.
 *    (블록마다 독립 가운데 정렬돼 = 위치가 제멋대로 떠다니는 문제 방지) */
function renderMdNoBacktick(text: string): string {
  const s = text.replace(/\r\n?/g, '\n').trim()
  if (!s) return ''
  const parts = s.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/)

  // 토큰화 — display 블록 사이의 공백뿐인 텍스트는 원래도 출력이 없으므로 버린다
  type Tok = { kind: 'display'; inner: string } | { kind: 'text'; text: string }
  const toks: Tok[] = []
  for (const part of parts) {
    if (!part) continue
    const p = part.trim()
    const isDisplay =
      (p.startsWith('$$') && p.endsWith('$$')) || (p.startsWith('\\[') && p.endsWith('\\]'))
    if (isDisplay) toks.push({ kind: 'display', inner: p.slice(2, -2).trim() })
    else if (p) toks.push({ kind: 'text', text: part })
  }

  const out: string[] = []
  const pushDisplay = (inner: string) =>
    out.push(`<div class="math-display-block">${promoteFrac(`$$\n${inner}\n$$`)}</div>`)
  // aligned 등 환경이 이미 든 블록은 병합 대상에서 제외 (환경 중첩 불가)
  const chainable = (x: string) => !x.includes('\\begin{')

  let i = 0
  while (i < toks.length) {
    const t = toks[i]
    if (t.kind === 'text') {
      for (const para of t.text.split(/\n\s*\n/)) {
        const tt = para.trim()
        if (!tt) continue
        out.push(`<p>${renderPlainWithInlineMath(tt).replace(/\n/g, '<br>')}</p>`)
      }
      i++
      continue
    }

    // 현재 display 뒤로 "= 시작 display" 들을 모아 체인 구성
    const rows: string[] = []
    let j = i + 1
    if (chainable(t.inner)) {
      while (j < toks.length) {
        const n = toks[j]
        if (n.kind !== 'display' || !chainable(n.inner) || !n.inner.startsWith('=')) break
        rows.push(n.inner)
        j++
      }
    }
    if (rows.length === 0) {
      pushDisplay(t.inner)
      i++
      continue
    }

    // aligned 행 구성 — & 는 = 바로 앞: 첫 행의 첫 = 와 이후 행의 = 가 세로 정렬
    const aligned: string[] = []
    const eq = firstTopLevelEq(t.inner)
    if (t.inner.startsWith('=')) aligned.push('&' + t.inner)
    else if (eq >= 0) aligned.push(t.inner.slice(0, eq) + '&=' + t.inner.slice(eq + 1))
    else aligned.push(`${t.inner} &${rows.shift()}`)
    for (const r of rows) aligned.push('&' + r)
    pushDisplay(`\\begin{aligned}\n${aligned.join(' \\\\\n')}\n\\end{aligned}`)
    i = j
  }
  return out.join('\n')
}

/** 최상위 렌더 — `백틱` 구간은 조건 박스 (render_md) */
function renderMd(text: string): string {
  const s = String(text ?? '').replace(/\r\n?/g, '\n').trim()
  if (!s) return ''
  const segments = s.split(/`([^`]+)`/)
  const out: string[] = []
  segments.forEach((seg, i) => {
    if (!seg) return
    if (i % 2 === 1) {
      out.push(`<div class="backtick-block centered-box">${renderMdNoBacktick(seg)}</div>`)
    } else {
      out.push(renderMdNoBacktick(seg))
    }
  })
  return out.join('\n')
}

/* ── 컴포넌트 ────────────────────────────────────────────────── */

export function MathJaxExplainRender({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderMd(text), [text])

  useEffect(() => {
    let alive = true
    loadMathJax().then(() => {
      const el = ref.current
      const MJ = window.MathJax
      if (!alive || !el || !MJ?.typesetPromise) return
      MJ.typesetClear?.([el])
      MJ.typesetPromise([el]).catch(() => {})
    })
    return () => {
      alive = false
    }
  }, [html])

  return (
    // 바깥 root 가 폭 측정용 컨테이너 — 안쪽 폰트가 cqw(컨테이너 폭 %)로 반응
    <div className="exam-mj-root">
      <div ref={ref} className="exam-mj" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
