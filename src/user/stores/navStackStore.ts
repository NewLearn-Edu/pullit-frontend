import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * 앱 자체 방문 스택 (2026-09-04) — 브라우저 히스토리를 대신하는 "직전 화면" 진실원.
 *
 * 브라우저 뒤로가기(버튼·엣지 스와이프)는 전 화면에서 흡수하므로(useBlockBackNavigation) window.history 는
 * 가드 엔트리로 뒤섞여 navigate(-1) 을 쓸 수 없다. 대신 라우터 이동을 여기 기록하고, 헤더의 뒤로가기는
 * 이 스택의 직전 주소로 replace 이동한다 — 앞으로만 가는 내비게이션이라 히스토리 모양에 기대지 않는다.
 *
 * - PUSH: 쌓기 · REPLACE: 맨 위 교체 · POP: 문서의 첫 기록(첫 로드·새로고침·딥링크)만 쌓고 이후는 무시 —
 *   이후의 POP 은 가드 팝(같은 주소)이거나 재장전 전에 잠깐 새는 이전 주소라 스택에 반영하면 안 된다
 * - 루트 화면(랜딩 · 홈)에 도착하면 스택을 그 화면 하나로 리셋한다 — 결과 화면에서 홈으로 나간 뒤
 *   풀이·결과 주소가 밑에 남아 있지 않게
 * - sessionStorage 에 남겨 새로고침·소셜 로그인 왕복(외부 도메인 리다이렉트) 뒤에도 깊이가 유지된다
 */
const ROOTS = new Set(['/', '/home'])
const MAX_DEPTH = 50

type NavType = 'POP' | 'PUSH' | 'REPLACE'

/** 이 문서에서 기록이 한 번이라도 있었는가 — 첫 POP(로드) 만 받기 위한 표식. persist 대상 아님 */
let recordedOnce = false

interface NavStackState {
  stack: string[]
  record: (type: NavType, key: string) => void
  /** 직전 주소를 꺼낸다 — 없으면 null (스택은 현재 화면을 빼고 직전 화면이 맨 위가 되게 줄인다) */
  back: () => string | null
}

export const useNavStackStore = create<NavStackState>()(
  persist(
    (set, get) => ({
      stack: [],
      record: (type, key) => {
        if (type === 'POP' && recordedOnce) return
        recordedOnce = true
        const stack = get().stack
        const path = key.split('?')[0]
        if (ROOTS.has(path)) {
          if (stack.length !== 1 || stack[0] !== key) set({ stack: [key] })
          return
        }
        const top = stack[stack.length - 1]
        if (type === 'REPLACE' && stack.length > 0) {
          if (top !== key) set({ stack: [...stack.slice(0, -1), key] })
          return
        }
        if (top === key) return
        set({ stack: [...stack, key].slice(-MAX_DEPTH) })
      },
      back: () => {
        const stack = get().stack
        if (stack.length < 2) return null
        const next = stack.slice(0, -1)
        set({ stack: next })
        return next[next.length - 1]
      },
    }),
    {
      name: 'pullit_nav_stack',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

/** 직전 화면이 있는가 — 헤더 뒤로가기 표시 판정 */
export const selectCanGoBack = (s: NavStackState) => s.stack.length > 1
