/**
 * 영어 독해 능력 4분류 (2026-08-07 정책 확정 · Confluence "영어 유형" §2)
 *
 * 영어는 학년 무관 응시라 단원이 아닌 "독해 능력"이 관리 단위.
 * 서비스 제공 유형을 측정 능력 기준으로 4개 능력에 배치한다 (2026-08-12 표 기준).
 * 어드민의 정식 명칭(officialName) 트리와 홈의 표시 명칭(name) 칩이 같은 체계를 공유.
 */
export interface EnglishAbility {
  /** 표시 명칭 — 홈 칩 등 학생 노출용 */
  name: string
  /** 정식 명칭 — 어드민 분류 트리·문서용 */
  officialName: string
  /** 포함 유형 (2026-08-12 표 기준 15유형 — 종합·추론만 3유형) */
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
    // 밑줄 함의 = 원본 voca01·voca04 통합 (voca03 어휘 쓰임은 서비스 제외).
    // DB skill_node 는 '어휘 의미' — 어드민 트리(NODE_ORDER)는 DB 명을 그대로 쓴다
    types: ['빈칸', '요약', '밑줄 함의'],
  },
  {
    name: '정보 확인',
    officialName: '정보 확인 능력',
    types: ['안내문 일치', '안내문 불일치', '내용 불일치', '도표'],
  },
]
