import {
  fetchProblemSet,
  fetchTrialProblemSet,
  type ProblemSetItem,
  type TrialProblemSetItem,
} from '@/user/api/problemApi'
import { issueProblemSet, type IssuedProblemSet } from '@/user/api/problemSetApi'
import {
  getProblemsByEnglishType,
  getProblemsBySkillNode,
  type Problem,
} from '@/user/data/mockProblems'
import type { Subject } from '@/user/stores/trialStore'

/**
 * 퀴즈 문제 세트 공급자 (2026-08-13)
 *
 * 서버(GET /api/problems)를 우선 사용하고, 유닛에 서버 문항이 없거나 조회에 실패하면
 * 기존 목 데이터로 폴백해 흐름을 유지한다.
 *
 * 세션 단위 캐시를 두는 이유 — 풀이(TrialQuizPage)·결과(WeaknessResultPage)·
 * 해설(TrialReviewPage)이 "같은 문제 배열"을 봐야 결과 매칭이 어긋나지 않는다.
 */

/** 맛보기 세트 문항 수 — 정책 3문항 */
const SET_SIZE = 3

/**
 * 목 노드 id → unit_code (문제 생성 정책 §4 코드 체계).
 * 맛보기 세트(trial_problems.group_code)와 문제 은행 조회(GET /api/problems?unitCode=)가
 * 같은 코드를 쓴다 — unit_code 가 단원 정보의 단일 진실원.
 * (trialProgressStore 가 서버 진단 기록의 group_code 를 유닛으로 되돌릴 때도 사용)
 */
export const TRIAL_GROUPS: Record<string, string> = {
  'sn-exp-log-01': 'math_2022_1_1_1', // 지수와 로그
  'sn-exp-log-02': 'math_2022_1_1_2', // 지수함수와 로그함수
  'sn-trig-01': 'math_2022_1_2_1', // 삼각함수
  'sn-trig-02': 'math_2022_1_2_2', // 사인법칙과 코사인법칙
  'sn-seq-01': 'math_2022_1_3_1', // 등차수열과 등비수열
  'sn-seq-02': 'math_2022_1_3_2', // 수열의 합
  'sn-diff-01': 'math_2022_2_2_1', // 미분계수
  'sn-diff-02': 'math_2022_2_2_3', // 도함수의 활용
  'sn-int-01': 'math_2022_2_3_1', // 부정적분
  'sn-int-02': 'math_2022_2_3_3', // 정적분의 활용
  'sn-stat-01': 'math_2022_3_2_2', // 조건부확률
  'sn-stat-02': 'math_2022_3_3_1', // 확률분포
  'en-topic': 'english_2015_1_0_1', // 주제
  'en-blank': 'english_2015_3_0_1', // 빈칸 추론
}

/** 서버 recommendedTimeSec 미수신 시 폴백 (배점 기준 · 목 데이터와 동일 값) */
const MATH_TIME_BY_POINTS: Record<number, [number, number]> = {
  2: [30, 90],
  3: [90, 270],
  4: [180, 540],
}
const ENGLISH_TIME: [number, number] = [90, 270]

/**
 * 서버 문항 → 프론트 Problem.
 * 문제 은행 문항은 정답이 안 내려와 answer=0 (채점은 제출 응답으로),
 * 맛보기 문항(TrialProblemSetItem)은 정답·해설이 포함돼 로컬 채점한다 —
 * 맛보기는 가입 전(세션 없음) 풀이라 서버 채점이 불가능하다.
 */
function toQuizProblem(
  item: ProblemSetItem | TrialProblemSetItem,
  index: number,
  subject: Subject,
  nodeId: string,
): Problem {
  // 배점은 소수 허용(1.5·2.5) — 로컬 Problem.points(2|3|4)는 시간 폴백용으로만 근사한다
  const points = item.score >= 4 ? 4 : item.score >= 3 ? 3 : 2
  // 권장 시간은 서버 문항값이 정본, 제한시간 = ×3 (문제 생성 정책 §2)
  const [fallbackRec, fallbackMax] =
    subject === 'math' ? MATH_TIME_BY_POINTS[points] : ENGLISH_TIME
  const tRecSec = item.recommendedTimeSec > 0 ? item.recommendedTimeSec : fallbackRec
  const tMaxSec = item.recommendedTimeSec > 0 ? item.recommendedTimeSec * 3 : fallbackMax

  // 맛보기 세트만 정답을 내려준다 — 객관식 answerIndex(1~5) · 단답형 answerValue(정답 숫자값)
  const withAnswer = item as Partial<TrialProblemSetItem>
  const localAnswer = withAnswer.answerIndex ?? withAnswer.answerValue ?? null

  return {
    id: index + 1,
    serverId: item.id,
    subject,
    skillNodeId: subject === 'math' ? nodeId : undefined,
    englishTypeId: subject === 'english' ? nodeId : undefined,
    points,
    tRecSec,
    tMaxSec,
    // question = 발문·지문·조판 통합 원문 (블록 배열 직렬화면 렌더러가 파싱)
    bodyText: item.question,
    choices: item.choices,
    glossary: item.glossary?.length ? item.glossary : undefined,
    answer: localAnswer ?? 0,
    // 맛보기는 서버 해설을 로컬로 — 은행 문항은 제출 응답(serverExplanation)으로 채워진다
    explanation: { intent: '', correctAnalysis: withAnswer.explanation ?? '' },
    translation: withAnswer.translation ?? null,
    vocabulary: withAnswer.vocabulary?.length ? withAnswer.vocabulary : undefined,
  }
}

const cache = new Map<string, Problem[]>()
const inflight = new Map<string, Promise<Problem[]>>()

function mockProblemsOf(subject: Subject, nodeId: string): Problem[] {
  return subject === 'math' ? getProblemsBySkillNode(nodeId) : getProblemsByEnglishType(nodeId)
}

/**
 * 유닛의 퀴즈 문제 세트 — 서버 우선, 실패·부족 시 목 폴백. 결과는 세션 캐시.
 * single-flight 라 여러 화면이 동시에 불러도 요청은 1회만 나간다.
 */
export async function loadQuizProblems(subject: Subject, nodeId: string): Promise<Problem[]> {
  const key = `${subject}:${nodeId}`
  const cached = cache.get(key)
  if (cached) return cached
  const pending = inflight.get(key)
  if (pending) return pending

  const promise = (async () => {
    // 1순위: 어드민 선별 맛보기 세트 (trial_problems) — 세트가 성립하면 그대로 채택
    const trialGroup = TRIAL_GROUPS[nodeId]
    if (trialGroup) {
      try {
        const items = await fetchTrialProblemSet(subject, trialGroup)
        if (items.length >= SET_SIZE) {
          const mapped = items
            .slice(0, SET_SIZE)
            .map((item, i) => toQuizProblem(item, i, subject, nodeId))
          cache.set(key, mapped)
          return mapped
        }
      } catch {
        // 네트워크·서버 오류 — 은행 조회로 폴백
      }
    }

    // 2순위: 문제 은행 — 같은 unit_code 로 조회 (코드 오름차순 상위 3개)
    if (trialGroup) {
      try {
        const items = await fetchProblemSet(subject, trialGroup, SET_SIZE)
        // 세트가 성립할 만큼 문항이 있어야 서버를 채택 — 부족하면 목으로
        if (items.length >= SET_SIZE) {
          const mapped = items
            .slice(0, SET_SIZE)
            .map((item, i) => toQuizProblem(item, i, subject, nodeId))
          cache.set(key, mapped)
          return mapped
        }
      } catch {
        // 네트워크·서버 오류 — 목 폴백으로 흐름 유지
      }
    }
    let mock = mockProblemsOf(subject, nodeId)
    // 영어 주제(en-topic)는 아직 목 문항이 없다 — 서버(주제 문항 업로드 후)가 정상 경로이고,
    // 서버 실패 시에만 빈칸 목으로 흐름을 유지한다 (로컬 개발용 임시 폴백)
    if (mock.length === 0 && subject === 'english') {
      mock = getProblemsByEnglishType('en-blank')
    }
    cache.set(key, mock)
    return mock
  })().finally(() => inflight.delete(key))

  inflight.set(key, promise)
  return promise
}

/**
 * 발급 세트 로드 (2026-08-30) — 세트 발급 API 를 태우고 결과를 세션 캐시에 심는다.
 *
 * 발급은 서버에서 크레딧 차감+구성+박제가 한 트랜잭션이고, ACTIVE 세트가 있으면
 * 그대로 반환된다(이어풀기·재차감 없음) — 몇 번을 불러도 안전하다.
 * 캐시를 같은 키(subject:nodeId)에 심어 풀이·결과·해설 화면이 같은 배열을 본다.
 */
export async function loadIssuedSet(
  subject: Subject,
  nodeId: string,
  unitCode: string,
  source: 'TRIAL' | 'FREE' | 'DAILY',
): Promise<{ set: IssuedProblemSet; problems: Problem[]; firstUnsolvedIdx: number }> {
  const set = await issueProblemSet(subject, unitCode, source)
  const problems = set.items.map((item, i) => toQuizProblem(item, i, subject, nodeId))
  cache.set(`${subject}:${nodeId}`, problems)
  const firstUnsolvedIdx = Math.max(0, set.items.findIndex((item) => !item.submitted))
  return { set, problems, firstUnsolvedIdx }
}

/** 이미 로드된 세트 동기 조회 — 캐시가 없으면(새로고침 직행 등) null */
export function getCachedQuizProblems(subject: Subject, nodeId: string): Problem[] | null {
  return cache.get(`${subject}:${nodeId}`) ?? null
}
