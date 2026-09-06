import { ExamText, MathExplainLayout } from './ExamText'
import { MathJaxExplainRender } from './ExamMathJax'

/**
 * 수능 본문 렌더러 4종 — 모든 화면(어드민 미리보기·업로드 검토·학생 문제풀이·해설)은
 * 반드시 이 4개만 사용한다. ExamText/KatexText 를 페이지에서 직접 쓰지 말 것.
 *
 * 문제 조판: 수능 문제지 — 블록 수식 가운데 정렬 · 조건 박스/밑줄
 * 해설 조판: 파이썬 렌더러(pullit-review-note render_md)와 동일 —
 *            빈 줄 = 문단, $$블록$$ 가운데 정렬, 증감표 실선 표
 */

/** 수학 문제 본문 */
export function MathProblemRender({ text }: { text: string }) {
  return <ExamText text={text} />
}

/** 수학 해설 본문 — 검수 도구(파이썬 렌더러) 방식 그대로: HTML 규칙·CSS·MathJax */
export function MathExplainRender({ text }: { text: string }) {
  return <MathJaxExplainRender text={text} />
}

/** (비교용) 우리 KaTeX 조판 해설 — 업로드 검토의 엔진 토글에서만 사용 */
export function MathExplainKatexRender({ text }: { text: string }) {
  return <MathExplainLayout text={text} />
}

/** 영어 문제 본문 — lang="en" 으로 영문 서체·하이픈 분철 활성화 */
export function EnglishProblemRender({ text }: { text: string }) {
  return (
    <span lang="en">
      <ExamText text={text} />
    </span>
  )
}

/** 영어 해설 본문 — 파이썬 렌더러는 과목 구분 없이 동일 규칙 */
export function EnglishExplainRender({ text }: { text: string }) {
  return <MathJaxExplainRender text={text} />
}

/**
 * 보기 번호 → 원기호. 원을 직접 그리지 않고 해설(선택지별 진단)과 똑같은
 * 유니코드 글리프를 그대로 쓴다 — 문제와 해설의 원기호 모양을 일치시키기 위함.
 * filled=true 는 학생 리뷰 화면의 "내가 고른 보기"(채운 원 ❶~❺).
 */
export function choiceMark(no: number, filled = false): string {
  const marks = filled
    ? ['❶', '❷', '❸', '❹', '❺']
    : ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
  return marks[no - 1] ?? String(no)
}
