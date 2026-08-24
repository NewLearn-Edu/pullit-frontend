/**
 * 영어 4영역 × 15유형 (문제 생성 정책 §4.2 · 2026-08 확정)
 *
 * 영어는 학년 무관 응시라 단원이 아닌 "영역"이 관리 단위 (수학 대단원 위치).
 * 영역명·유형명이 곧 정식 명칭이며 DB unit_large/skill_node 에도 같은 값이
 * 저장된다 — 어드민 트리·유저뷰·백엔드 공통 (UnitCatalog 파생).
 */
export interface EnglishAbility {
  /** 영역 명칭 — DB unit_large 와 동일 (홈 칩·어드민 트리·문서 공통) */
  name: string
  /** 포함 유형 — 표시명 기준 (15유형) */
  types: string[]
}

export const ENGLISH_ABILITIES: EnglishAbility[] = [
  {
    name: '중심 내용 파악',
    types: ['주제', '제목', '요지', '목적'],
  },
  {
    name: '논리 구조 이해',
    types: ['주장', '문장 삽입', '글의 순서', '무관한 문장'],
  },
  {
    name: '종합·추론 능력',
    types: ['빈칸 추론', '요약문', '함축 의미'],
  },
  {
    name: '정보 확인 능력',
    types: ['안내문 내용 일치', '안내문 내용 불일치', '본문 내용 불일치', '도표'],
  },
]
