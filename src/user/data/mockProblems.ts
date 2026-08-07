/**
 * POC 목 데이터 - 문제 세트
 * 출처: /math_level_test/2022_1_1_1_trial-test_01.jsonl (지수와 로그 · 1단원)
 * 4문제 (basic × 1 · normal × 2 · advanced × 1) 실제 수능형 문제.
 *
 * bodyText / conditions / question / choices / explanation 안의 `$...$` 는 KaTeX 인라인 · `$$...$$` 는 블록 수식.
 */
export interface Problem {
  id: number
  /**
   * 서버 problems 테이블의 실제 PK (예: 2022_1_1_1-S0252).
   * 풀이 기록(POST /api/attempts)은 이 값으로 전송하며, 없으면 서버 저장을 건너뛴다.
   * 유저용 문제 조회 API 가 생기면 목 데이터와 함께 제거될 임시 매핑.
   */
  serverId?: string
  subject: 'math' | 'english'
  skillNodeId?: string
  englishTypeId?: string
  points: 2 | 3 | 4
  tRecSec: number
  tMaxSec: number
  bodyText: string // 본문 (KaTeX 지원)
  conditions?: string[] // 조건 (가), (나) 등 (KaTeX 지원)
  question?: string // 마지막 질문 문장
  choices: string[] // 객관식 5개 · 주관식(단답형)은 빈 배열
  answer: number // 객관식 1-5 · 주관식은 정답값 자체 (음수 가능)
  explanation: {
    intent: string
    correctAnalysis: string
    wrongAnalysis?: string
  }
}

/**
 * 지수와 로그 · 실제 수능 대비 4문제 (2022_1_1_1_trial-test_01)
 */
const problemsMathSample: Problem[] = [
  {
    id: 1,
    serverId: '2022_1_1_1-S0252',
    subject: 'math',
    skillNodeId: 'sn-exp-log-01',
    points: 2,
    tRecSec: 30,
    tMaxSec: 90,
    bodyText:
      '양수 $a$에 대하여 $\\dfrac{\\sqrt[3]{a^4} \\times \\sqrt[6]{a}}{a^{\\frac{1}{2}}} = 2$일 때, $a^3$의 값을 구하시오.',
    choices: ['① $2$', '② $4$', '③ $8$', '④ $16$', '⑤ $32$'],
    answer: 3,
    explanation: {
      intent:
        '유리수 지수의 지수법칙을 이용해 거듭제곱근 식을 정리하고, 밑의 조건을 확인하는 능력을 확인합니다.',
      correctAnalysis:
        '거듭제곱근을 분수 형태의 지수로 나타내면 $\\sqrt[3]{a^4} = a^{\\frac{4}{3}}$, $\\sqrt[6]{a} = a^{\\frac{1}{6}}$이다.\n\n지수법칙을 이용하여 주어진 식의 좌변을 정리하면\n$$\\dfrac{\\sqrt[3]{a^4} \\times \\sqrt[6]{a}}{a^{\\frac{1}{2}}} = \\dfrac{a^{\\frac{4}{3}} \\times a^{\\frac{1}{6}}}{a^{\\frac{1}{2}}} = \\dfrac{a^{\\frac{4}{3} + \\frac{1}{6}}}{a^{\\frac{1}{2}}} = \\dfrac{a^{\\frac{3}{2}}}{a^{\\frac{1}{2}}} = a^{\\frac{3}{2} - \\frac{1}{2}} = a$$\n따라서 $a = 2$이고, $a^3 = 2^3 = 8$이다.',
      wrongAnalysis:
        '$a$의 값을 구한 후 거듭제곱을 완료하지 않고 $a = 2$나 $a^2 = 4$를 답으로 선택하면 오답 (선지 ①, ②) 이 된다. 지수법칙의 덧셈과 뺄셈 연산을 잘못하여 $a^4 = 16$이나 $a^5 = 32$를 도출한 경우 또한 오답 (선지 ④, ⑤) 이 된다.',
    },
  },
  {
    id: 2,
    serverId: '2022_1_1_1-S0235',
    subject: 'math',
    skillNodeId: 'sn-exp-log-01',
    points: 3,
    tRecSec: 90,
    tMaxSec: 270,
    bodyText:
      '자연수 $n$에 대하여 $\\log_2(n-1)+\\log_2(13-n)$의 값이 자연수가 되도록 하는 모든 $n$의 값의 합을 $S$라 하자. $S$의 값을 구하시오.',
    choices: ['① $12$', '② $14$', '③ $16$', '④ $18$', '⑤ $21$'],
    answer: 2,
    explanation: {
      intent:
        '로그의 진수 조건 · 로그의 성질 · 이차함수의 최댓값을 결합해 조건을 만족하는 자연수를 찾는 유형입니다.',
      correctAnalysis:
        '로그의 진수 조건에 의하여 $n-1 > 0$, $13-n > 0$이므로 $1 < n < 13$이다. $n$은 자연수이므로 가능한 $n$의 값은 $2, 3, \\dots, 12$이다.\n\n로그의 성질에 의하여\n$$\\log_2(n-1)+\\log_2(13-n) = \\log_2((n-1)(13-n))$$\n이 값이 자연수가 되려면 $(n-1)(13-n) = 2^m$ (자연수 $m$) 이어야 한다.\n\n$x = n-1$이라 하면 $1 \\le x \\le 11$인 정수 $x$에 대하여 $x(12-x) = -(x-6)^2 + 36 \\le 36$이므로 가능한 $2^m$의 값은 $2, 4, 8, 16, 32$이다.\n\n각 경우 정수해를 확인하면 $x(12-x) = 32$일 때만 $x = 4$ 또는 $x = 8$의 정수해를 가진다. 즉 $n = 5$ 또는 $n = 9$이다.\n\n따라서 $S = 5 + 9 = 14$이다.',
      wrongAnalysis:
        '진수 조건을 고려하지 않거나, 치환한 변수 $x = 4, 8$에서 원래 변수 $n$으로 복귀하지 않은 경우 $4 + 8 = 12$ (선지 ①) 를 정답으로 오인할 수 있다.',
    },
  },
  {
    id: 3,
    serverId: '2022_1_1_1-S0009',
    subject: 'math',
    skillNodeId: 'sn-exp-log-01',
    points: 3,
    tRecSec: 90,
    tMaxSec: 270,
    bodyText:
      '$$2^{-3} \\times (2^2 \\times 3^{-1})^2 \\div (2^{-2} \\times 3^{-3})$$의 값을 구하시오.',
    // 주관식(단답형) — 원문이 "구하시오" 단답 유형이라 보기 없이 값 입력으로 전환 (2026-08-07)
    choices: [],
    answer: 24,
    explanation: {
      intent: '정수 지수의 지수법칙 · 사칙연산을 정확하게 적용하는 계산 능력을 확인합니다.',
      correctAnalysis:
        '지수법칙을 이용하여 주어진 식을 간단히 하면 다음과 같다.\n$$2^{-3} \\times (2^2 \\times 3^{-1})^2 \\div (2^{-2} \\times 3^{-3})$$\n$$= 2^{-3} \\times (2^4 \\times 3^{-2}) \\div (2^{-2} \\times 3^{-3})$$\n$$= 2^{-3+4-(-2)} \\times 3^{-2-(-3)}$$\n$$= 2^3 \\times 3^1 = 8 \\times 3 = 24$$',
    },
  },
  {
    id: 4,
    serverId: '2022_1_1_1-S0269',
    subject: 'math',
    skillNodeId: 'sn-exp-log-01',
    points: 4,
    tRecSec: 180,
    tMaxSec: 540,
    bodyText:
      '좌표평면 위의 원 $(x - 3)^2 + (y - 4)^2 = 25$ 위의 점 중 $x$좌표와 $y$좌표가 모두 정수인 점의 집합을 $A$라 하자. $2$ 이상의 자연수 $n$에 대하여 집합 $B_n$을\n$$B_n = \\{ x \\mid x \\text{는 실수이고 어떤 } (a, b) \\in A \\text{에 대하여 } (x^n - a)(x^n - b) = 0 \\}$$\n이라 할 때, $\\sum\\limits_{n=2}^{11} n(B_n)$의 값을 구하시오. (단, $n(X)$는 집합 $X$의 원소의 개수이다.)',
    choices: ['① $105$', '② $110$', '③ $115$', '④ $120$', '⑤ $125$'],
    answer: 5,
    explanation: {
      intent:
        '원 위의 격자점 · 방정식 $x^n = k$의 실근 개수 · 급수 계산을 결합한 킬러 유형입니다.',
      correctAnalysis:
        '원 $(x-3)^2 + (y-4)^2 = 25$ 위의 정수 격자점은 $X = x-3$, $Y = y-4$로 치환하면 $X^2 + Y^2 = 25$를 만족하는 순서쌍이고, 총 $12$개이다.\n\n집합 $A$의 원소의 $x$좌표 또는 $y$좌표가 될 수 있는 모든 정수의 집합은 $K = \\{-2, -1, 0, 1, 3, 4, 6, 7, 8, 9\\}$로 원소는 $10$개이다. 이 중 음수 $2$개, $0$은 $1$개, 양수 $7$개.\n\n$B_n$은 $x^n = k$ ($k \\in K$) 의 모든 실근의 집합.\n\n(i) $n$이 홀수 ($n = 3, 5, 7, 9, 11$) 일 때: 각 $k$마다 실근 $1$개 · $n(B_n) = 10$\n\n(ii) $n$이 짝수 ($n = 2, 4, 6, 8, 10$) 일 때: 음수 $k$는 실근 $0$개 · $k = 0$은 $1$개 · 양수 $k$는 $2$개 · $n(B_n) = 2 \\times 0 + 1 \\times 1 + 7 \\times 2 = 15$\n\n짝수 $n$이 $5$개 · 홀수 $n$이 $5$개이므로\n$$\\sum_{n=2}^{11} n(B_n) = 5 \\times 15 + 5 \\times 10 = 75 + 50 = 125$$',
    },
  },
]

const problemsEnglishSample: Problem[] = [
  {
    id: 101,
    subject: 'english',
    englishTypeId: 'en-blank',
    points: 3,
    tRecSec: 90,
    tMaxSec: 270,
    bodyText:
      'The most surprising thing about human memory is not that we forget so much, but that we ______ so much.',
    choices: ['① forget', '② remember', '③ regret', '④ hide', '⑤ deny'],
    answer: 2,
    explanation: {
      intent: '역접 구조 (not A but B) 에서 대비되는 어휘를 추론합니다.',
      correctAnalysis: 'forget 과 대비되는 표현은 remember. 정답은 ②.',
    },
  },
  {
    id: 102,
    subject: 'english',
    englishTypeId: 'en-blank',
    points: 3,
    tRecSec: 90,
    tMaxSec: 270,
    bodyText:
      'Children learn language not by memorizing rules but by ______ patterns from the sounds they hear around them.',
    choices: [
      '① avoiding',
      '② extracting',
      '③ ignoring',
      '④ rejecting',
      '⑤ inventing',
    ],
    answer: 2,
    explanation: {
      intent: '문맥에 맞는 동사를 고르는 어휘 추론 유형입니다.',
      correctAnalysis: '아이는 규칙 암기가 아니라 패턴을 "추출" 하며 배웁니다. 정답은 ②.',
    },
  },
  {
    id: 103,
    subject: 'english',
    englishTypeId: 'en-blank',
    points: 3,
    tRecSec: 90,
    tMaxSec: 270,
    bodyText:
      'Great scientists are often described as curious, but curiosity alone is not ______; it must be paired with rigorous method.',
    choices: [
      '① sufficient',
      '② dangerous',
      '③ obvious',
      '④ personal',
      '⑤ recent',
    ],
    answer: 1,
    explanation: {
      intent: '문맥 이해 · but 이후 문장에서 힌트를 얻는 능력을 확인합니다.',
      correctAnalysis: '"호기심만으로는 X 하지 않다, 방법론이 필요하다" → sufficient. 정답은 ①.',
    },
  },
  {
    id: 104,
    subject: 'english',
    englishTypeId: 'en-blank',
    points: 3,
    tRecSec: 90,
    tMaxSec: 270,
    bodyText:
      'Innovation rarely comes from a single genius; more often it emerges from the ______ of many people building on each other.',
    choices: [
      '① rivalry',
      '② isolation',
      '③ collaboration',
      '④ imitation',
      '⑤ resistance',
    ],
    answer: 3,
    explanation: {
      intent: '문맥 흐름 파악 · 대조 후 대안 개념을 찾는 유형입니다.',
      correctAnalysis: '"한 명의 천재가 아니라 여러 명" 이라 했으므로 협업 (collaboration). 정답은 ③.',
    },
  },
]

export const MOCK_PROBLEMS: Problem[] = [
  ...problemsMathSample,
  ...problemsEnglishSample,
]

/** 맛보기 세트 문항 수 — 정책 3문항 ("딱 3문제만 더 풀면", 성적 상승까지 3문제) */
const TRIAL_PROBLEM_COUNT = 3

/**
 * POC 목 데이터는 sn-exp-log-01 · en-blank 만 실제로 준비. 다른 skill_node · type 선택 시
 * 흐름을 끊지 않기 위해 수학 · 영어 각 과목의 문제를 fallback 으로 반환.
 */
export function getProblemsBySkillNode(skillNodeId: string): Problem[] {
  const matched = MOCK_PROBLEMS.filter((p) => p.skillNodeId === skillNodeId)
  if (matched.length >= TRIAL_PROBLEM_COUNT) return matched.slice(0, TRIAL_PROBLEM_COUNT)
  return MOCK_PROBLEMS.filter((p) => p.subject === 'math').slice(0, TRIAL_PROBLEM_COUNT)
}

export function getProblemsByEnglishType(typeId: string): Problem[] {
  const matched = MOCK_PROBLEMS.filter((p) => p.englishTypeId === typeId)
  if (matched.length >= TRIAL_PROBLEM_COUNT) return matched.slice(0, TRIAL_PROBLEM_COUNT)
  return MOCK_PROBLEMS.filter((p) => p.subject === 'english').slice(0, TRIAL_PROBLEM_COUNT)
}
