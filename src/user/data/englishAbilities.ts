/**
 * 영어 4영역 × 4유형 = 16유형 (2026-08-14 확정)
 *
 * 영어는 학년 무관 응시라 단원이 아닌 "영역"이 관리 단위 (수학 대단원 위치).
 * 축약 영역명(내용 파악·글의 흐름·어휘·추론·정보 확인)이 곧 정식 명칭이며
 * DB unit_large 에도 같은 값이 저장된다 — 어드민 트리·유저뷰·백엔드 공통.
 */
export interface EnglishAbility {
  /** 영역 명칭 — DB unit_large 와 동일 (홈 칩·어드민 트리·문서 공통) */
  name: string
  /** 구 정식 명칭 (2026-08-14 이전 문서 호환용) */
  officialName: string
  /** 포함 유형 4개 — 표시명 기준 (16유형) */
  types: string[]
}

export const ENGLISH_ABILITIES: EnglishAbility[] = [
  {
    name: '내용 파악',
    officialName: '중심 내용 파악',
    types: ['목적', '주제', '제목', '요지'],
  },
  {
    name: '글의 흐름',
    officialName: '논리 구조 이해',
    types: ['주장', '글의 순서', '문장 삽입', '무관한 문장'],
  },
  {
    name: '어휘·추론',
    officialName: '종합·추론 능력',
    // 밑줄 함의 = 원본 voca01·voca04 통합 (DB skill_node '어휘 의미').
    // 어휘 쓰임 = voca03 (DB skill_node 그대로) — 2026-08-14 어휘·추론에 편입.
    types: ['빈칸', '요약', '밑줄 함의', '어휘 쓰임'],
  },
  {
    name: '정보 확인',
    officialName: '정보 확인 능력',
    types: ['안내문 일치', '안내문 불일치', '내용 불일치', '도표'],
  },
]
