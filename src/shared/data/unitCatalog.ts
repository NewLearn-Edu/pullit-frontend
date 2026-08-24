/**
 * unit_code → 단원 명칭 카탈로그 (문제 생성 정책 §4 · 백엔드 UnitCatalog 미러).
 *
 * 코드 체계: {과목}_{교육과정}_{대단원}_{중단원}_{소단원}
 * 수학 21개 {대단원, 중단원, 소단원} · 영어 15개 {영역, -, 유형} (중단원 자리 항상 0).
 * 어드민 업로드 파일명 인식·경로 미리보기에 사용한다.
 */
export interface UnitInfo {
  subject: 'math' | 'english'
  unitLarge: string
  unitMid: string | null
  skillNode: string
}

const m = (large: string, mid: string, skill: string): UnitInfo => ({
  subject: 'math',
  unitLarge: large,
  unitMid: mid,
  skillNode: skill,
})
const e = (area: string, type: string): UnitInfo => ({
  subject: 'english',
  unitLarge: area,
  unitMid: null,
  skillNode: type,
})

export const UNIT_CATALOG: Record<string, UnitInfo> = {
  // 수학 — 21개
  math_2022_1_1_1: m('대수', '지수·로그함수', '지수와 로그'),
  math_2022_1_1_2: m('대수', '지수·로그함수', '지수함수와 로그함수'),
  math_2022_1_2_1: m('대수', '삼각함수', '삼각함수'),
  math_2022_1_2_2: m('대수', '삼각함수', '사인법칙과 코사인법칙'),
  math_2022_1_3_1: m('대수', '수열', '등차수열과 등비수열'),
  math_2022_1_3_2: m('대수', '수열', '수열의 합'),
  math_2022_1_3_3: m('대수', '수열', '수학적 귀납법'),
  math_2022_2_1_1: m('미적분Ⅰ', '극한·연속', '함수의 극한'),
  math_2022_2_1_2: m('미적분Ⅰ', '극한·연속', '함수의 연속'),
  math_2022_2_2_1: m('미적분Ⅰ', '미분', '미분계수'),
  math_2022_2_2_2: m('미적분Ⅰ', '미분', '도함수'),
  math_2022_2_2_3: m('미적분Ⅰ', '미분', '도함수의 활용'),
  math_2022_2_3_1: m('미적분Ⅰ', '적분', '부정적분'),
  math_2022_2_3_2: m('미적분Ⅰ', '적분', '정적분'),
  math_2022_2_3_3: m('미적분Ⅰ', '적분', '정적분의 활용'),
  math_2022_3_1_1: m('확률과 통계', '경우의 수', '순열과 조합'),
  math_2022_3_1_2: m('확률과 통계', '경우의 수', '이항정리'),
  math_2022_3_2_1: m('확률과 통계', '확률', '확률의 뜻과 이용'),
  math_2022_3_2_2: m('확률과 통계', '확률', '조건부확률'),
  math_2022_3_3_1: m('확률과 통계', '통계', '확률분포'),
  math_2022_3_3_2: m('확률과 통계', '통계', '통계적 추정'),
  // 영어 — 15개 (영역 4 × 유형)
  english_2015_1_0_1: e('중심 내용 파악', '주제'),
  english_2015_1_0_2: e('중심 내용 파악', '제목'),
  english_2015_1_0_3: e('중심 내용 파악', '요지'),
  english_2015_1_0_4: e('중심 내용 파악', '목적'),
  english_2015_2_0_1: e('논리 구조 이해', '주장'),
  english_2015_2_0_2: e('논리 구조 이해', '문장 삽입'),
  english_2015_2_0_3: e('논리 구조 이해', '글의 순서'),
  english_2015_2_0_4: e('논리 구조 이해', '무관한 문장'),
  english_2015_3_0_1: e('종합·추론 능력', '빈칸 추론'),
  english_2015_3_0_2: e('종합·추론 능력', '요약문'),
  english_2015_3_0_3: e('종합·추론 능력', '함축 의미'),
  english_2015_4_0_1: e('정보 확인 능력', '안내문 내용 일치'),
  english_2015_4_0_2: e('정보 확인 능력', '안내문 내용 불일치'),
  english_2015_4_0_3: e('정보 확인 능력', '본문 내용 불일치'),
  english_2015_4_0_4: e('정보 확인 능력', '도표'),
}

/**
 * unit_code(또는 problem_code·trial 파일명처럼 unit_code 로 시작하는 문자열)를
 * "대단원 › 중단원 › 소단원" 경로로 변환. 인식 실패 시 null.
 */
export function unitCodeToPath(code: string): string | null {
  // 뒤에서부터 잘라가며 카탈로그 키 탐색 — problem_code(…_0042)·파일명도 허용
  let key = code
  while (key.includes('_')) {
    const unit = UNIT_CATALOG[key]
    if (unit) {
      return unit.unitMid
        ? `${unit.unitLarge} › ${unit.unitMid} › ${unit.skillNode}`
        : `${unit.unitLarge} › ${unit.skillNode}`
    }
    key = key.slice(0, key.lastIndexOf('_'))
  }
  return null
}
