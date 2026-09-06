import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchUnitLocks } from '@/user/api/recommendApi'
import { type Subject } from '@/user/stores/trialStore'

const EMPTY: Record<string, string> = {}

interface LockState {
  /** 이 맵이 어느 과목 것인지 — 과목이 다르면 맵을 아예 안 쓴다 */
  subject: Subject | null
  map: Record<string, string>
}

/**
 * "안배웠어요" 잠금(unit_locks) — categoryCode → off 시작 소단원 unit_code.
 *
 * 맵에 과목을 같이 박아 둔다 (2026-09-06). 예전엔 페이지마다 `useState({})` 에 맵만 담고
 * 과목이 바뀌어도 그대로 뒀다 — 영어 탭으로 옮기면 새 조회가 끝날 때까지 수학 맵(또는 빈 맵)이
 * 남아서, 건너뛴 유형이 "진단하기" 로 열려 보였다가 조회가 도착하면 다시 잠기는 깜빡임이 있었다.
 * 조회가 실패해도 이전 과목 맵을 쓰지 않는다 — 잠금 없음으로 그리되 남의 과목 잠금은 안 그린다.
 */
export function useUnitLocks(subject: Subject, enabled = true) {
  const [state, setState] = useState<LockState>({ subject: null, map: EMPTY })
  // 늦게 도착한 이전 과목 응답이 현재 과목 맵을 덮어쓰지 않게
  const token = useRef(0)

  const refresh = useCallback(() => {
    const mine = (token.current += 1)
    return fetchUnitLocks(subject)
      .then((list) => {
        if (mine !== token.current) return
        const map: Record<string, string> = {}
        for (const lock of list) map[lock.categoryCode] = lock.offFromUnitCode
        setState({ subject, map })
      })
      .catch(() => {
        if (mine === token.current) setState({ subject, map: EMPTY })
      })
  }, [subject])

  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh])

  // 과목이 바뀐 직후 렌더에서 바로 "아직 모름" 이 된다 (별도 초기화 이펙트 없이)
  const matched = state.subject === subject
  return {
    locks: matched ? state.map : EMPTY,
    /** 이 과목 잠금 조회가 한 번이라도 끝났나 — false 동안 소단원 카드를 그리면 안 된다 */
    ready: matched,
    refresh,
  }
}
