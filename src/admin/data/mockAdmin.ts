/**
 * problem-admin 프로토타입의 데모 데이터 이관.
 * 수식 구분자는 프로토타입의 \( \) 대신 KatexText 규격($...$)으로 변환했다.
 * 실서비스 API 연동 시 이 파일 전체가 대체 대상.
 */

export type ProblemStatus = 'pending' | 'live' | 'hidden'

export const STATUS_LABEL: Record<ProblemStatus, string> = {
  pending: '검수 대기',
  live: '게시 중',
  hidden: '비공개',
}

export interface MathProblem {
  id: number
  big: string
  mid: string
  small: string
  score: number
  status: ProblemStatus
  solves: number
  date: string
  render: 'LaTeX' | '이미지' | '텍스트'
}

export const MATH_PROBLEMS: MathProblem[] = [
  { id: 12847, big: '미적분', mid: '적분법', small: '정적분의 활용', score: 4, status: 'pending', solves: 1204, date: '2026.07.24', render: 'LaTeX' },
  { id: 12845, big: '수학Ⅰ', mid: '삼각함수', small: '사인법칙과 코사인법칙', score: 3, status: 'live', solves: 861, date: '2026.07.24', render: 'LaTeX' },
  { id: 12844, big: '확률과 통계', mid: '통계', small: '정규분포', score: 3, status: 'live', solves: 1032, date: '2026.07.23', render: 'LaTeX' },
  { id: 12843, big: '수학Ⅱ', mid: '미분', small: '접선의 방정식', score: 3, status: 'live', solves: 1547, date: '2026.07.23', render: 'LaTeX' },
  { id: 12842, big: '수학Ⅰ', mid: '지수함수와 로그함수', small: '로그함수의 그래프', score: 2, status: 'live', solves: 1893, date: '2026.07.21', render: '이미지' },
  { id: 12841, big: '기하', mid: '이차곡선', small: '타원의 방정식', score: 4, status: 'pending', solves: 236, date: '2026.07.21', render: '이미지' },
  { id: 12839, big: '확률과 통계', mid: '확률', small: '조건부확률', score: 3, status: 'live', solves: 954, date: '2026.07.19', render: 'LaTeX' },
  { id: 12837, big: '기하', mid: '공간벡터', small: '벡터의 내적', score: 4, status: 'live', solves: 512, date: '2026.07.18', render: 'LaTeX' },
  { id: 12836, big: '수학Ⅱ', mid: '적분', small: '정적분의 계산', score: 3, status: 'live', solves: 1105, date: '2026.07.17', render: 'LaTeX' },
  { id: 12835, big: '수학Ⅰ', mid: '수열', small: '등차수열', score: 2, status: 'live', solves: 2214, date: '2026.07.17', render: 'LaTeX' },
  { id: 12834, big: '미적분', mid: '미분법', small: '합성함수의 미분', score: 4, status: 'live', solves: 687, date: '2026.07.16', render: 'LaTeX' },
  { id: 12833, big: '확률과 통계', mid: '경우의 수', small: '순열과 조합', score: 2, status: 'live', solves: 1761, date: '2026.07.15', render: '텍스트' },
  { id: 12832, big: '수학Ⅱ', mid: '함수의 극한과 연속', small: '함수의 극한', score: 2, status: 'live', solves: 1980, date: '2026.07.15', render: 'LaTeX' },
  { id: 12831, big: '수학Ⅰ', mid: '지수함수와 로그함수', small: '지수법칙', score: 2, status: 'hidden', solves: 1420, date: '2026.07.14', render: 'LaTeX' },
  { id: 12830, big: '미적분', mid: '수열의 극한', small: '급수의 합', score: 4, status: 'live', solves: 573, date: '2026.07.13', render: 'LaTeX' },
  { id: 12829, big: '기하', mid: '평면벡터', small: '벡터의 연산', score: 3, status: 'live', solves: 808, date: '2026.07.12', render: 'LaTeX' },
  { id: 12828, big: '수학Ⅰ', mid: '삼각함수', small: '삼각함수의 그래프', score: 3, status: 'live', solves: 976, date: '2026.07.11', render: '이미지' },
  { id: 12827, big: '확률과 통계', mid: '확률', small: '독립시행', score: 3, status: 'pending', solves: 341, date: '2026.07.10', render: 'LaTeX' },
  { id: 12826, big: '수학Ⅱ', mid: '미분', small: '도함수의 활용', score: 4, status: 'live', solves: 1288, date: '2026.07.09', render: 'LaTeX' },
  { id: 12825, big: '수학Ⅰ', mid: '수열', small: '등비수열', score: 2, status: 'live', solves: 2045, date: '2026.07.08', render: 'LaTeX' },
  { id: 12824, big: '미적분', mid: '적분법', small: '치환적분', score: 4, status: 'live', solves: 655, date: '2026.07.07', render: 'LaTeX' },
  { id: 12823, big: '기하', mid: '이차곡선', small: '포물선의 방정식', score: 3, status: 'live', solves: 730, date: '2026.07.06', render: '이미지' },
  { id: 12822, big: '확률과 통계', mid: '통계', small: '표본평균', score: 3, status: 'live', solves: 618, date: '2026.07.05', render: 'LaTeX' },
  { id: 12821, big: '수학Ⅱ', mid: '적분', small: '부정적분', score: 2, status: 'live', solves: 1512, date: '2026.07.04', render: 'LaTeX' },
  { id: 12820, big: '수학Ⅰ', mid: '지수함수와 로그함수', small: '로그의 성질', score: 2, status: 'live', solves: 1876, date: '2026.07.03', render: 'LaTeX' },
  { id: 12819, big: '미적분', mid: '미분법', small: '매개변수 미분', score: 4, status: 'hidden', solves: 289, date: '2026.07.02', render: 'LaTeX' },
  { id: 12818, big: '확률과 통계', mid: '경우의 수', small: '중복조합', score: 3, status: 'live', solves: 934, date: '2026.07.01', render: '텍스트' },
  { id: 12817, big: '수학Ⅱ', mid: '함수의 극한과 연속', small: '함수의 연속', score: 2, status: 'live', solves: 1327, date: '2026.06.30', render: 'LaTeX' },
  { id: 12816, big: '기하', mid: '공간벡터', small: '공간좌표', score: 3, status: 'live', solves: 442, date: '2026.06.29', render: '이미지' },
  { id: 12815, big: '수학Ⅰ', mid: '삼각함수', small: '삼각함수의 뜻', score: 2, status: 'pending', solves: 1093, date: '2026.06.28', render: 'LaTeX' },
]

export const MATH_BY_ID = new Map(MATH_PROBLEMS.map((p) => [p.id, p]))

export interface EnglishProblem {
  id: number
  title: string
  sub: string
  diff: 1 | 2 | 3
  status: ProblemStatus
  solves: number
  date: string
}

export const DIFF_LABEL: Record<EnglishProblem['diff'], string> = {
  1: '쉬움',
  2: '보통',
  3: '어려움',
}

export const ENGLISH_PROBLEMS: EnglishProblem[] = [
  { id: 12846, title: '고2 영어 빈칸추론 실전 #7', sub: '독해 · 빈칸추론', diff: 2, status: 'live', solves: 982, date: '2026.07.23' },
  { id: 12840, title: '고1 영어 어법 종합 #18', sub: '어법 · 수일치', diff: 1, status: 'live', solves: 2041, date: '2026.07.20' },
  { id: 12838, title: '고3 영어 어휘 추론 #12', sub: '독해 · 어휘 추론', diff: 2, status: 'pending', solves: 388, date: '2026.07.19' },
]

// ---- 문제 미리보기 (데모) ----

export interface ProblemPreview {
  path: string
  score: string
  q: string
  passage?: string
  choices: string[]
}

export const PREVIEWS: Record<number, ProblemPreview> = {
  12847: {
    path: '미적분 › 적분법 › 정적분의 활용',
    score: '4점',
    q: '곡선 $y=x^2-2x$ 와 $x$축으로 둘러싸인 부분의 넓이를 구하시오.',
    choices: ['$\\dfrac{2}{3}$', '$1$', '$\\dfrac{4}{3}$', '$2$', '$\\dfrac{8}{3}$'],
  },
  12842: {
    path: '수학Ⅰ › 지수함수와 로그함수 › 로그함수의 그래프',
    score: '2점',
    q: '양수 $a$에 대하여 $\\dfrac{\\sqrt[3]{a^4}\\times\\sqrt[6]{a}}{a^{\\frac{1}{2}}}=2$일 때, $a^3$의 값을 구하시오.',
    choices: ['$2$', '$4$', '$8$', '$16$', '$32$'],
  },
  12839: {
    path: '확률과 통계 › 확률 › 조건부확률',
    score: '3점',
    q: '두 사건 $A,\\ B$에 대하여 $P(A)=\\dfrac{1}{3},\\ P(A\\cap B)=\\dfrac{1}{6}$일 때, $P(B\\mid A)$의 값을 구하시오.',
    choices: ['$\\dfrac{1}{6}$', '$\\dfrac{1}{4}$', '$\\dfrac{1}{3}$', '$\\dfrac{1}{2}$', '$\\dfrac{2}{3}$'],
  },
  12837: {
    path: '기하 › 공간벡터 › 벡터의 내적',
    score: '4점',
    q: '두 벡터 $\\vec{a},\\ \\vec{b}$에 대하여 $|\\vec{a}|=2,\\ |\\vec{b}|=3$이고 두 벡터가 이루는 각의 크기가 $60^\\circ$일 때, $\\vec{a}\\cdot\\vec{b}$의 값을 구하시오.',
    choices: ['$1$', '$2$', '$3$', '$4$', '$6$'],
  },
  12846: {
    path: '독해 › 빈칸추론',
    score: '3점',
    q: '다음 빈칸에 들어갈 말로 가장 적절한 것을 고르시오.',
    passage:
      'The most successful innovations rarely come from a single flash of insight. Instead, they emerge when ideas from different fields ______ in unexpected ways, creating combinations no one had considered before.',
    choices: ['compete', 'collide', 'converge', 'diminish', 'stabilize'],
  },
  12840: {
    path: '어법 › 수일치',
    score: '2점',
    q: '다음 중 어법상 옳은 문장을 고르시오.',
    passage: 'The number of students who ______ the online course has increased sharply since last year.',
    choices: ['take', 'takes', 'taking', 'taken', 'to take'],
  },
  12838: {
    path: '독해 › 어휘 추론',
    score: '3점',
    q: '밑줄 친 단어와 의미가 가장 가까운 것을 고르시오.',
    passage: 'Her explanation was so lucid that even beginners could follow the argument without difficulty.',
    choices: ['vague', 'clear', 'lengthy', 'complex', 'abstract'],
  },
}

/** 상세 미리보기가 없는 문제는 대단원별 대표 문항으로 표시 (데모) */
export const FALLBACK_PREVIEW: Record<string, Pick<ProblemPreview, 'q' | 'choices'>> = {
  '수학Ⅰ': {
    q: '$\\log_{2}32+\\log_{3}\\dfrac{1}{9}$의 값을 구하시오.',
    choices: ['$1$', '$2$', '$3$', '$4$', '$5$'],
  },
  '수학Ⅱ': {
    q: "함수 $f(x)=x^{3}-3x^{2}+5$에 대하여 $f'(2)$의 값을 구하시오.",
    choices: ['$-2$', '$-1$', '$0$', '$1$', '$2$'],
  },
  '미적분': {
    q: '$\\displaystyle\\lim_{n\\to\\infty}\\dfrac{3n^{2}+n}{n^{2}+1}$의 값을 구하시오.',
    choices: ['$1$', '$2$', '$3$', '$4$', '$5$'],
  },
  '확률과 통계': {
    q: '${}_{5}\\mathrm{C}_{3}+{}_{4}\\mathrm{P}_{2}$의 값을 구하시오.',
    choices: ['$18$', '$20$', '$22$', '$24$', '$26$'],
  },
  '기하': {
    q: '두 벡터 $\\vec{a}=(1,\\,2),\\ \\vec{b}=(3,\\,-1)$에 대하여 $\\vec{a}\\cdot\\vec{b}$의 값을 구하시오.',
    choices: ['$-1$', '$0$', '$1$', '$2$', '$3$'],
  },
}

export function getPreview(id: number): ProblemPreview | null {
  const preview = PREVIEWS[id]
  if (preview) return preview
  const m = MATH_BY_ID.get(id)
  const fallback = m && FALLBACK_PREVIEW[m.big]
  if (!m || !fallback) return null
  return { ...fallback, path: `${m.big} › ${m.mid} › ${m.small}`, score: `${m.score}점` }
}

// ---- 분류 캐스케이드 (2022 코드 표 Sheet2: 과목 › 대분류 › 중분류) ----

export const UNITS: Record<string, Record<string, string[]>> = {
  '대수': {
    '지수함수와 로그함수': ['지수와로그', '지수함수와 로그함수'],
    '삼각함수': ['삼각함수', '사입법칙과 코사인법칙'],
    '수열': ['등차수열과 등비수열', '수열의 합', '수학적 귀납법'],
  },
  '미적분 I': {
    '함수의 극한과 연속': ['함수의 극한', '함수의 연속'],
    '미분': ['미분계수', '도함수', '도함수의 활용'],
    '적분': ['부정적분', '정적분', '정적분의 활용'],
  },
  '확률과 통계': {
    '경우의수': ['순열과 조합', '이항정리'],
    '확률': ['확률의 뜻과 이용', '조건부확률'],
    '통계': ['확률분포', '통계적추정'],
  },
}

/** 정규화: 공백 제거 + 로마숫자 통일 + 2015→2022 과목 별칭 (데모 데이터 매칭용) */
const UNIT_ALIAS: Record<string, string> = { '수학I': '대수', '수학II': '미적분I' }

export function normUnit(s: string | null | undefined): string {
  const n = (s ?? '').replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II')
  return UNIT_ALIAS[n] ?? n
}

// ---- 업로드 파일명 → 단원 자동 인식 ----

const CODE_SUBJECT: Record<string, string> = { '1': '대수', '2': '미적분 I', '3': '확률과 통계' }

/** `2022_x_x_x` 형식의 파일명 코드를 "과목 › 대분류 › 소분류" 경로로 변환. 실패 시 null */
export function codeToPath(code: string): string | null {
  const m = code.match(/^2022_(\d)_(\d)_(\d)$/)
  if (!m) return null
  const subj = CODE_SUBJECT[m[1]]
  if (!subj || !UNITS[subj]) return null
  const big = Object.keys(UNITS[subj])[+m[2] - 1]
  const small = big ? UNITS[subj][big][+m[3] - 1] : null
  return big && small ? `${subj} › ${big} › ${small}` : null
}
