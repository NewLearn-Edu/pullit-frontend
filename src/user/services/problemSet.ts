import { fetchProblemSet, fetchTrialProblemSet, type ProblemSetItem } from '@/user/api/problemApi'
import {
  getProblemsByEnglishType,
  getProblemsBySkillNode,
  type Problem,
} from '@/user/data/mockProblems'
import { MOCK_SKILL_NODES } from '@/user/data/mockSkillNodes'
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

/** 목 노드 id → 서버 skill_node 조회 키 (영어 유형) */
const ENGLISH_SERVER_NODES: Record<string, string> = {
  'en-topic': '주제', // 맛보기 고정 영역 (맛보기 테스트 정책 §2.2)
  'en-blank': '빈칸',
}

/**
 * 목 노드 id → 맛보기 세트 그룹 코드 (trial_problems.group_code = 임포트 파일명 그룹).
 * 수학은 2022 단원 코드(단원·유형 명칭 정책 §1.1), 영어는 유형 파일명 그룹.
 * 어드민이 해당 그룹의 trial-test 파일을 올리면 이 세트가 1순위로 출제된다.
 */
const TRIAL_GROUPS: Record<string, string> = {
  'sn-exp-log-01': '2022_1_1_1', // 지수와 로그
  'sn-exp-log-02': '2022_1_1_2', // 지수함수와 로그함수
  'sn-trig-01': '2022_1_2_1', // 삼각함수
  'sn-trig-02': '2022_1_2_2', // 사인법칙과 코사인법칙
  'sn-seq-01': '2022_1_3_1', // 등차수열과 등비수열
  'sn-seq-02': '2022_1_3_2', // 수열의 합
  'sn-diff-01': '2022_2_2_1', // 미분계수
  'sn-diff-02': '2022_2_2_3', // 도함수의 활용
  'sn-int-01': '2022_2_3_1', // 부정적분
  'sn-int-02': '2022_2_3_3', // 정적분의 활용
  'sn-stat-01': '2022_3_2_2', // 조건부확률
  'sn-stat-02': '2022_3_3_1', // 확률분포
  'en-topic': '01_topic', // 영어 주제 — 실제 임포트 파일명 그룹과 일치해야 함
  'en-blank': 'r12_blank',
}

/**
 * 권장/최대 풀이 시간 — 서버 스키마에 없어 배점 기준 로컬 정책으로 채운다.
 * 목 데이터와 같은 값 (2점 30/90 · 3점 90/270 · 4점 180/540, 영어는 일괄 90/270).
 */
const MATH_TIME_BY_POINTS: Record<number, [number, number]> = {
  2: [30, 90],
  3: [90, 270],
  4: [180, 540],
}
const ENGLISH_TIME: [number, number] = [90, 270]

/** 목 노드 id → 서버 skill_node 정식 명칭. 매핑이 없으면 서버 조회를 건너뛴다 */
function serverSkillNodeOf(subject: Subject, nodeId: string): string | null {
  if (subject === 'english') return ENGLISH_SERVER_NODES[nodeId] ?? null
  return MOCK_SKILL_NODES.find((n) => n.id === nodeId)?.name ?? null
}

/** 서버 문항 → 프론트 Problem. 정답은 서버가 안 내려주므로 answer=0 (원기호 표시는 '-') */
function toQuizProblem(item: ProblemSetItem, index: number, subject: Subject, nodeId: string): Problem {
  const points = item.points === 3 || item.points === 4 ? item.points : 2
  const [tRecSec, tMaxSec] =
    subject === 'math' ? MATH_TIME_BY_POINTS[points] : ENGLISH_TIME

  return {
    id: index + 1,
    serverId: item.id,
    subject,
    skillNodeId: subject === 'math' ? nodeId : undefined,
    englishTypeId: subject === 'english' ? nodeId : undefined,
    points,
    tRecSec,
    tMaxSec,
    // 영어는 발문 + 지문을 이어 붙여 렌더 (목 데이터와 같은 단일 본문 구조)
    bodyText: item.passage ? `${item.question}\n\n${item.passage}` : item.question,
    choices: item.choices,
    answer: 0,
    // 해설은 제출 응답(serverExplanation)으로 채워진다 — 로컬 해설 없음
    explanation: { intent: '', correctAnalysis: '' },
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

    // 2순위: 문제 은행 (skill_node 오름차순 상위 3개)
    const skillNode = serverSkillNodeOf(subject, nodeId)
    if (skillNode) {
      try {
        const items = await fetchProblemSet(subject, skillNode, SET_SIZE)
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

/** 이미 로드된 세트 동기 조회 — 캐시가 없으면(새로고침 직행 등) null */
export function getCachedQuizProblems(subject: Subject, nodeId: string): Problem[] | null {
  return cache.get(`${subject}:${nodeId}`) ?? null
}
