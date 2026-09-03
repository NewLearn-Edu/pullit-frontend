import { loadIssuedSet } from '@/user/services/problemSet'
import { setCreditUsedFlash } from '@/user/components/CreditUsedToast'
import { useTrialStore, type Subject } from '@/user/stores/trialStore'
import { useTrialProgressStore, SET_CREDIT_COST } from '@/user/stores/trialProgressStore'
import { useUserStore } from '@/user/stores/userStore'

/**
 * 소단원 진단(TRIAL) 세트 시작 — 홈 시트·추천 리빌 CTA 가 같은 경로를 탄다 (2026-09-03).
 *
 * 서버 세트 발급(POST /api/problem-sets · TRIAL)이 크레딧 차감·문항 구성·박제를 한 트랜잭션으로
 * 처리하고, 이 세트의 제출이 3건 모이면 서버가 진단 완료(trial_diagnoses)를 판정한다.
 * 이전 추천 리빌은 크레딧만 따로 차감한 뒤 세트 없이 고정 서빙 문항으로 들어가서
 * 진단이 박제되지 않고 같은 문제가 반복됐다 — 그 경로를 이걸로 대체한다.
 *
 * @returns 이동할 풀이 경로 (/trial/quiz/{subject}/{첫 미제출 문항})
 */
export async function startTrialSetSession(
  subject: Subject,
  row: { name: string; unitCode: string; nodeId?: string },
  returnTo: string,
  creditBefore: number,
): Promise<string> {
  const nodeId = row.nodeId ?? (subject === 'math' ? 'sn-exp-log-01' : 'en-blank')
  const { set, problems, firstUnsolvedIdx } = await loadIssuedSet(subject, nodeId, row.unitCode, 'TRIAL')

  // 잔액 갱신 — 새 발급이면 차감이 반영됐다. 토스트의 남은 개수도 이 서버 값으로 (캐시 creditBefore 는 낡았을 수 있다)
  const me = await useUserStore.getState().loadMe(true)
  // 새 발급 = 차감 발생 → 문제 첫 화면 토스트 (이어풀기는 차감 없음 · 2857-21836)
  if (!set.resumed) setCreditUsedFlash(SET_CREDIT_COST, me?.creditBalance ?? creditBefore - SET_CREDIT_COST)

  const trial = useTrialStore.getState()
  trial.reset()
  trial.setLastSubject(subject)
  if (subject === 'math') trial.setMathSkillNode(nodeId)
  else trial.setEnglishType(nodeId)
  trial.setActiveSetId(set.setId)
  // 이어풀기 — 이미 제출한 문항의 결과를 복원해 결과 화면 집계가 어긋나지 않게
  set.items.forEach((item, i) => {
    if (!item.submitted) return
    const problem = problems[i]
    useTrialStore.getState().addResult(subject, {
      problemId: problem.id,
      selectedChoice: null,
      correct: item.correct ?? false,
      serverCorrect: item.correct ?? false,
      earnedPoints: item.correct ? problem.points : 0,
      timeoverFlag: false,
      peekedBeforeAnswer: false,
      elapsedMs: 0,
    })
  })
  useTrialProgressStore.getState().startUnit({ unitName: row.name, returnTo })
  return `/trial/quiz/${subject}/${firstUnsolvedIdx}`
}
