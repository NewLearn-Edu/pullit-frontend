import { ENGLISH_ABILITIES } from '@/user/data/englishAbilities'
import type { Subject } from '@/user/stores/trialStore'

/**
 * 진단 커리큘럼 단일 진실원 (2026-08-12 확정)
 *
 * 잠금 해제 단위 = 카테고리.
 *   수학: 대단원 (대수 · 미적분 I · 확률과 통계)  ← 서버 problems.unit_large
 *   영어: 독해 능력 4분류                        ← 학년 무관이라 단원이 없음
 *
 * 진단 단위 = 유닛.
 *   수학: 소단원, 영어: 유형                      ← 서버 problems.skill_node (약점 판정 단위)
 *
 * 유닛 하나 = 맛보기 3문제 한 세트. 카테고리의 유닛을 전부 진단해야
 * 그 카테고리의 약점 그래프(레이더)가 열린다 — 축이 다 채워져야 그래프가 의미를 가지므로.
 *
 * 중단원(unit_mid)은 서버엔 있지만 학생 화면에서는 쓰지 않는다 (리스트를 평평하게 유지).
 */

export interface CurriculumUnit {
  /**
   * 표시 명칭 — 약점 지도(mathWeaknessMap)와 같은 축약 표기 (2026-08-12 표).
   * 서버 skill_node 정식 명칭("지수와 로그")과는 normalize 느슨 매칭으로 잇는다.
   * 진단 저장(diagnosed) 키로도 쓰인다.
   */
  name: string
  /**
   * 맛보기 문제 조회 키 (POC 목 데이터용).
   * 목이 준비된 유닛만 실제 문항이 나오고, 나머지는 과목 fallback 문항으로 흐름만 유지된다.
   */
  nodeId?: string
}

export interface CurriculumCategory {
  /** 홈 칩 · 잠금 해제 단위 */
  name: string
  /** URL 파라미터 (한글 인코딩 회피) */
  slug: string
  units: CurriculumUnit[]
}

const MATH_CATEGORIES: CurriculumCategory[] = [
  {
    name: '대수',
    slug: 'algebra',
    units: [
      { name: '지수·로그', nodeId: 'sn-exp-log-01' },
      { name: '지수·로그함수', nodeId: 'sn-exp-log-02' },
      { name: '삼각함수', nodeId: 'sn-trig-01' },
      { name: '사인·코사인법칙', nodeId: 'sn-trig-02' },
      { name: '등차·등비수열', nodeId: 'sn-seq-01' },
      { name: '수열의 합', nodeId: 'sn-seq-02' },
      { name: '수학적 귀납법' },
    ],
  },
  {
    name: '미적분 I',
    slug: 'calculus',
    // 약점 지도(mathWeaknessMap) 노드 구성과 동일 — 홈 그래프 축·소단원 리스트가 지도와 맞아야 한다
    units: [
      { name: '함수의 극한' },
      { name: '함수의 연속' },
      { name: '미분계수', nodeId: 'sn-diff-01' },
      { name: '도함수' },
      { name: '도함수 활용', nodeId: 'sn-diff-02' },
      { name: '부정적분' },
      { name: '정적분' },
      { name: '정적분 활용' },
    ],
  },
  {
    name: '확률과 통계',
    slug: 'statistics',
    // 약점 지도(mathWeaknessMap) 노드 구성과 동일
    units: [
      { name: '순열·조합' },
      { name: '이항정리' },
      { name: '확률의 뜻·이용' },
      { name: '조건부확률', nodeId: 'sn-stat-01' },
      { name: '확률분포' },
      { name: '통계적 추정' },
    ],
  },
]

/** 영어 유형 → 문제 세트 노드 키 (문항이 준비된 유형만) */
const ENGLISH_NODE_IDS: Record<string, string> = {
  주제: 'en-topic', // 맛보기 고정 영역 — 서버 주제 문항 업로드 후 활성
  빈칸: 'en-blank',
}

/** 영어 카테고리 = 독해 능력 4분류 — englishAbilities 단일 원천에서 파생 */
const ENGLISH_CATEGORIES: CurriculumCategory[] = ENGLISH_ABILITIES.map((ability, i) => ({
  name: ability.name,
  slug: `ability-${i + 1}`,
  units: ability.types.map((name) => ({ name, nodeId: ENGLISH_NODE_IDS[name] })),
}))

export const CURRICULUM: Record<Subject, CurriculumCategory[]> = {
  math: MATH_CATEGORIES,
  english: ENGLISH_CATEGORIES,
}

/** 유닛 호칭 — 수학은 소단원, 영어는 유형 */
export const UNIT_LABEL: Record<Subject, string> = {
  math: '소단원',
  english: '유형',
}

export function findCategoryBySlug(
  subject: Subject,
  slug: string,
): CurriculumCategory | undefined {
  return CURRICULUM[subject].find((c) => c.slug === slug)
}

export function findCategoryByName(
  subject: Subject,
  name: string,
): CurriculumCategory | undefined {
  return CURRICULUM[subject].find((c) => c.name === name)
}
