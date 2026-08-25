import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { fetchSkillScores } from '@/user/api/attemptApi'
import { MOCK_SKILL_NODES } from '@/user/data/mockSkillNodes'
import { loadQuizProblems } from '@/user/services/problemSet'
import { useTrialStore } from '@/user/stores/trialStore'
import { useUserStore } from '@/user/stores/userStore'
import WeaknessRadar from '@/user/components/WeaknessRadar/WeaknessRadar'

/**
 * 약점 그래프 데모 시나리오 (Figma 2689-12016 기반 목 데이터).
 * 몇 초마다 단원 점수가 바뀌며 그래프가 morph — 미진단 단원이 채워지는 모습을
 * 미리 보여준다. 실제로 진단한 단원(지수·로그)은 시나리오와 무관하게 실점수로 고정.
 */
const RADAR_UNIT_NAMES = [
  '지수·로그',
  '지수·로그함수',
  '삼각함수',
  '사인·코사인',
  '등차·등비',
  '수열의 합',
  '수학적 귀납법',
]

const RADAR_SCENARIOS: number[][] = [
  [62, 100, 62, 100, 56, 100, 56], // 기본 (Figma 시안)
  [62, 55, 62, 100, 56, 100, 56], // 지수·로그함수가 약점으로 — 그래프가 줄어든다
  [78, 55, 45, 88, 56, 100, 74], // 삼각함수 악화 · 지수·로그/귀납법 회복
  [62, 100, 62, 64, 82, 62, 56], // 사인·코사인/수열의 합 약점 전환
]

/** 서버 skill_node("지수와 로그") ↔ 레이더 표시명("지수·로그") 느슨 매칭 */
const normalize = (s: string) => s.replace(/[·\s]/g, '').replace(/와|과/g, '')

/**
 * 이번 맛보기에서 진단한 단원의 실점수 (0~100 · null = 아직 모름).
 * 서버 누적 단원 점수(skill-scores)가 진실원이고, 도착 전·실패 시에는
 * 세션 결과로 같은 공식(맞춘 배점 ÷ 푼 배점 × 100)을 폴백 계산한다.
 */
function useDiagnosedScore(): { unitName: string | null; score: number | null } {
  const { mathSkillNodeId, mathResults, lastSubject } = useTrialStore()

  // 영어 맛보기는 레이더(수학 단원 축)에 대응 축이 없어 실점수를 얹지 않는다
  const unitName =
    lastSubject !== 'english' && mathResults.length > 0
      ? MOCK_SKILL_NODES.find((n) => n.id === mathSkillNodeId)?.name ?? null
      : null

  const [serverScore, setServerScore] = useState<number | null>(null)
  const [localScore, setLocalScore] = useState<number | null>(null)

  // 세션이 확보된 경우에만 서버 점수를 조회 — 익명 퍼널(로그인·가입 유도 화면)에서
  // 무조건 쏘면 401 → 재발급 401 콘솔 소음만 남는다. 익명은 아래 로컬 폴백으로 충분.
  const me = useUserStore((s) => s.me)
  useEffect(() => {
    if (!unitName || !me) return
    let alive = true
    fetchSkillScores('math')
      .then((list) => {
        if (!alive) return
        const row = list.find((s) => normalize(s.skillNode) === normalize(unitName))
        if (row) setServerScore(row.score)
      })
      .catch(() => {}) // 실패 시 세션 폴백 유지
    return () => {
      alive = false
    }
  }, [unitName, me])

  useEffect(() => {
    if (!unitName || !mathSkillNodeId) return
    let alive = true
    // 결과 화면과 같은 세트 캐시를 공유 — 보통 즉시 resolve
    loadQuizProblems('math', mathSkillNodeId).then((problems) => {
      if (!alive) return
      const total = mathResults.reduce(
        (s, r) => s + (problems.find((p) => p.id === r.problemId)?.points ?? 0),
        0,
      )
      const earned = mathResults.reduce(
        (s, r) =>
          s +
          ((r.serverCorrect ?? r.correct)
            ? problems.find((p) => p.id === r.problemId)?.points ?? 0
            : 0),
        0,
      )
      if (total > 0) setLocalScore(Math.round((earned * 100) / total))
    })
    return () => {
      alive = false
    }
  }, [unitName, mathSkillNodeId, mathResults])

  return { unitName, score: serverScore ?? localScore }
}

/**
 * 약점 레이더 데모 카드 (Figma 2824-5679 · 가입 유도/로그인 공용)
 * 라운드 40 카드 + 은은한 핑크 라디얼 블롭 배경 위에 약점 레이더를 얹는다.
 * 3.2초마다 데모 시나리오가 순환하며 morph 하고, 맛보기로 진단한 단원이 있으면
 * 그 축만 실점수로 고정된다 (세션 없는 방문자는 전체 데모로 동작).
 */
export default function RadarDemoCard({
  className,
  tinted = true,
}: {
  className?: string
  /** 핑크 라디얼 블롭 배경 — false 면 배경 없이 그래프만 (로그인 등 심플 배치용) */
  tinted?: boolean
}) {
  // 약점 그래프 데모 — 1.6초마다 시나리오 순환 (진단 단원 축은 실점수로 고정)
  // morph 트윈이 900ms 라 대기 체감은 ~0.7초 (기존 3.2초에서 절반 이하로 단축)
  const [scenarioIdx, setScenarioIdx] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(
      () => setScenarioIdx((i) => (i + 1) % RADAR_SCENARIOS.length),
      1600,
    )
    return () => clearInterval(timer)
  }, [])

  const { unitName, score: diagnosedScore } = useDiagnosedScore()
  const radarUnits = useMemo(() => {
    const pinnedIdx =
      unitName != null && diagnosedScore != null
        ? RADAR_UNIT_NAMES.findIndex((n) => normalize(n) === normalize(unitName))
        : -1
    return RADAR_UNIT_NAMES.map((name, i) => ({
      name,
      score: i === pinnedIdx ? (diagnosedScore as number) : RADAR_SCENARIOS[scenarioIdx][i],
    }))
  }, [scenarioIdx, unitName, diagnosedScore])

  return (
    <div
      className={clsx(
        'flex aspect-[323/400] max-h-[480px] w-full max-w-[388px] min-h-0 shrink items-center justify-center rounded-[40px] bg-white',
        className,
      )}
      style={
        tinted
          ? {
              backgroundImage:
                'radial-gradient(48% 36% at 80% 19%, rgba(255, 218, 223, 0.4), rgba(255, 255, 255, 0)),' +
                'radial-gradient(44% 33% at 17% 80%, rgba(255, 218, 223, 0.4), rgba(255, 255, 255, 0))',
            }
          : undefined
      }
    >
      <div className="aspect-[360/336] w-full max-w-[430px] px-[10px]">
        <WeaknessRadar units={radarUnits} className="h-full w-full" />
      </div>
    </div>
  )
}
