/**
 * POC 목 데이터 - 영어 독해 유형
 */
export interface EnglishType {
  id: string
  name: string
  points: 2 | 3
  description: string
}

export const MOCK_ENGLISH_TYPES: EnglishType[] = [
  { id: 'en-info', name: '안내문', points: 2, description: '실용문 · 안내문 이해' },
  { id: 'en-blank', name: '빈칸 추론', points: 3, description: '문맥에 맞는 표현 추론' },
  { id: 'en-order', name: '순서', points: 3, description: '주어진 글의 다음 순서 배열' },
  { id: 'en-insert', name: '삽입', points: 3, description: '문장이 들어갈 위치 판단' },
  { id: 'en-long', name: '장문 독해', points: 3, description: '긴 지문의 주제 · 세부 이해' },
]
