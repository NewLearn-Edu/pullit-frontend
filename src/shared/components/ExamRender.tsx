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
/**
 * 보기 목록을 그릴 필요가 있는가 (2026-09-06).
 *
 * 문장 삽입·무관한 문장·도표 유형은 ①~⑤ 가 지문·도표 안의 위치 표시로 이미 들어가 있고
 * choices 는 원기호만 담은 껍데기다 (english_2015_2_0_2 184건 · 2_0_4 51건 · 4_0_4 88건 —
 * 세 유형 모두 100%). 아래에 또 나열하면 같은 정보가 두 번 나온다 — 수능 지면도 이 유형들은
 * 선지를 따로 싣지 않는다.
 *
 * 채점 뒤 리뷰 화면은 예외 — 원기호에 "내 답 · 정답" 표시가 얹혀 정보가 되므로 그대로 그린다.
 */
export function hasChoiceContent(choices: string[]): boolean {
  return choices.some((c) => c.replace(/^[①②③④⑤]\s*/, '').trim().length > 0)
}

export function choiceMark(no: number, filled = false): string {
  const marks = filled
    ? ['❶', '❷', '❸', '❹', '❺']
    : ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
  return marks[no - 1] ?? String(no)
}
