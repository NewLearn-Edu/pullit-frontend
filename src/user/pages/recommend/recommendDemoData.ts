import type { Recommendation } from '@/user/api/recommendApi'
import type { Subject } from '@/user/stores/trialStore'
import type { UnitDiagnosis } from '@/user/stores/trialProgressStore'

/**
 * 추천 리빌 데모 데이터 (?rec-demo=1)
 *
 * 서버 없이 연출을 끝까지 돌려 보기 위한 고정 데이터. 실제 스토어(diagnosed)나
 * 서버 잠금(unit_locks)에는 전혀 쓰지 않고, 컴포넌트 안에서만 갈아 끼운다.
 *
 * 캔버스의 세 가지 상태가 다 나오도록 구성했다.
 *   - 진단 완료 (점수 있음 · 약점 포함)
 *   - 미진단 (다음 차례 · 잠김)
 *   - "안배웠어요" off 구간 — 그 소단원부터 대단원 끝까지 통으로 묶인다
 */

function done(score: number, minutes: number): UnitDiagnosis {
  return {
    score,
    weak: score < 70, // 서버 WEAK_THRESHOLD 와 동일
    minutes,
    correct: Math.round((score / 100) * 3),
    date: '2026-08-20',
    time: '21:14',
  }
}

/** ?rec-demo=1 — 서버 대신 고정 데이터로 연출을 끝까지 돌려 본다 (세션은 그대로 필요) */
export function isRecommendDemo(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('rec-demo') === '1'
}

export interface RecommendDemo {
  /** 유닛 표시명 → 진단 결과 */
  diagnosed: Record<string, UnitDiagnosis>
  /** 대단원 코드(unit_code 앞 3마디) → off 시작 소단원 코드 */
  locks: Record<string, string>
  recommendation: Recommendation
}

export const RECOMMEND_DEMO: Record<Subject, RecommendDemo> = {
  math: {
    diagnosed: {
      // 대수 — 앞 세 개를 풀었고 그 뒤는 "안배웠어요" 로 잠갔다
      '지수·로그': done(92, 8),
      '지수·로그함수': done(68, 12),
      삼각함수: done(45, 14),
      // 미적분 I — 두 개 완료, 다음이 미분계수
      '함수의 극한': done(88, 9),
      '함수의 연속': done(74, 10),
      // 확률과 통계 — 첫 칸만 완료
      '순열·조합': done(79, 11),
    },
    // 대수: 사인·코사인법칙(math_2022_1_2_2)부터 대단원 끝까지 off
    locks: { math_2022_1: 'math_2022_1_2_2' },
    recommendation: {
      type: 'DIAGNOSIS',
      unitCode: 'math_2022_2_2_1', // 미적분 I · 미분계수
      unitLarge: '미적분 I',
      skillNode: '미분계수',
      score: null,
      reason: '미적분 I 에 안 푼 진단이 있어 — 미분계수 진단',
    },
  },
  english: {
    diagnosed: {
      주제: done(33, 6),
      제목: done(71, 7),
      주장: done(82, 6),
      '빈칸 추론': done(56, 9),
    },
    // 논리 구조 이해: 문장 삽입(english_2015_2_0_2)부터 영역 끝까지 off
    locks: { english_2015_2: 'english_2015_2_0_2' },
    recommendation: {
      type: 'DIAGNOSIS',
      unitCode: 'english_2015_1_0_3', // 중심 내용 파악 · 요지
      unitLarge: '중심 내용 파악',
      skillNode: '요지',
      score: null,
      reason: '중심 내용 파악에 안 푼 유형이 있어 — 요지 진단',
    },
  },
}
