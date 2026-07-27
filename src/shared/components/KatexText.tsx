import { useMemo } from 'react'
import katex from 'katex'

/**
 * 수식 인라인/블록 렌더링.
 * 텍스트 안에서 `$...$` = 인라인, `$$...$$` = 블록 으로 표시.
 * 예: "log₂ 8 의 값" · "$\\log_2 8$ 의 값" · "$$g(x) = f(x)+1$$"
 */
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
        const html = katex.renderToString(p.value, {
          throwOnError: false,
          displayMode: p.type === 'block',
        })
        // 블록 수식은 KaTeX 가 한 덩어리로 렌더 → 폭 좁으면 넘침
        // overflow-x-auto 로 자체 스크롤 컨테이너 만들어 넘침 방지 · 사용자는 좌우 스크롤로 확인
        return (
          <span
            key={i}
            className={
              p.type === 'block'
                ? 'katex-block block my-md overflow-x-auto text-center'
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
  return parts
}
