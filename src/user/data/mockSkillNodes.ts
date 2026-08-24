/**
 * POC 목 데이터 - 수학 소단원 (skill_node)
 * name 은 DB skill_node 정식 명칭(문제 생성 정책 §4.1 · UnitCatalog)과 동일해야 한다 —
 * problemSet 이 이 값으로 서버 문제 은행(GET /api/problems)을 조회한다.
 */
export interface SkillNode {
  id: string
  unitLarge: string
  unitMid: string
  name: string
}

export const MOCK_SKILL_NODES: SkillNode[] = [
  { id: 'sn-exp-log-01', unitLarge: '대수', unitMid: '지수·로그함수', name: '지수와 로그' },
  { id: 'sn-exp-log-02', unitLarge: '대수', unitMid: '지수·로그함수', name: '지수함수와 로그함수' },
  { id: 'sn-trig-01', unitLarge: '대수', unitMid: '삼각함수', name: '삼각함수' },
  { id: 'sn-trig-02', unitLarge: '대수', unitMid: '삼각함수', name: '사인법칙과 코사인법칙' },
  { id: 'sn-seq-01', unitLarge: '대수', unitMid: '수열', name: '등차수열과 등비수열' },
  { id: 'sn-seq-02', unitLarge: '대수', unitMid: '수열', name: '수열의 합' },
  { id: 'sn-diff-01', unitLarge: '미적분Ⅰ', unitMid: '미분', name: '미분계수' },
  { id: 'sn-diff-02', unitLarge: '미적분Ⅰ', unitMid: '미분', name: '도함수의 활용' },
  { id: 'sn-int-01', unitLarge: '미적분Ⅰ', unitMid: '적분', name: '부정적분' },
  { id: 'sn-int-02', unitLarge: '미적분Ⅰ', unitMid: '적분', name: '정적분의 활용' },
  { id: 'sn-stat-01', unitLarge: '확률과 통계', unitMid: '확률', name: '조건부확률' },
  { id: 'sn-stat-02', unitLarge: '확률과 통계', unitMid: '통계', name: '확률분포' },
]
