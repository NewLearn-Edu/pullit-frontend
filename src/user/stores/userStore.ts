import { create } from 'zustand'
import { createGuestSession, fetchMe, type MeResult } from '@/user/api/authApi'

export type SessionStatus =
  | 'idle' // 아직 조회하지 않음
  | 'loading'
  | 'ready' // me 확보 (GUEST 또는 USER)
  | 'anonymous' // 세션 확보 실패 — 서버 저장 없이 로컬로만 진행

interface UserState {
  me: MeResult | null
  status: SessionStatus
  /** 조회만 — 세션이 없어도 게스트를 만들지 않는다 (홈·네비 등 표시용) */
  loadMe: (force?: boolean) => Promise<MeResult | null>
  /** 확보 — 없으면 게스트를 발급받는다 (맛보기 진입 전용) */
  ensureSession: () => Promise<MeResult | null>
  setMe: (me: MeResult | null) => void
  clear: () => void
}

/**
 * 세션 상태 전역 스토어.
 *
 * persist 를 붙이지 않는다 — 진실원은 httpOnly 쿠키이고, me 를 저장하면
 * 로그아웃·게스트 승격 후 stale 데이터가 남는다.
 *
 * react-query 를 쓰지 않는 이유: ensureSession 은 "없으면 만든다"는 부수효과가 있는
 * 명령형 절차라 useQuery 의 자동 refetch 와 충돌한다 (포커스 복귀 때마다 게스트가 생길 수 있음).
 */
// 동시 호출 합류용 — zustand 밖 모듈 스코프여야 StrictMode 이중 마운트에도 1회만 나간다
let loadPromise: Promise<MeResult | null> | null = null
let ensurePromise: Promise<MeResult | null> | null = null

/**
 * 세션 힌트 — "이 브라우저에 세션 쿠키가 있었을 것"이라는 표식.
 * httpOnly 쿠키는 JS 로 존재 여부를 알 수 없어, 힌트 없이는 첫 방문자에게도
 * 매 페이지 me 조회 → 401 → refresh 401 탐침이 나가 콘솔이 붉게 물든다.
 * 힌트가 없으면 조회 전용(loadMe)은 네트워크 없이 익명으로 단정한다.
 * (ensureSession 은 게스트 중복 생성 방지를 위해 항상 fetchMe 부터 — 힌트와 무관)
 */
const SESSION_HINT_KEY = 'pullit_session_hint'
const hasSessionHint = () => {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1'
  } catch {
    return true // storage 접근 불가 환경에선 기존 동작(조회 시도) 유지
  }
}
export const setSessionHint = () => {
  try {
    localStorage.setItem(SESSION_HINT_KEY, '1')
  } catch {
    /* noop */
  }
}
export const clearSessionHint = () => {
  try {
    localStorage.removeItem(SESSION_HINT_KEY)
  } catch {
    /* noop */
  }
}

export const useUserStore = create<UserState>((set, get) => ({
  me: null,
  status: 'idle',

  loadMe: (force = false) => {
    if (!force && get().status === 'ready') return Promise.resolve(get().me)
    // 세션 흔적이 없는 방문자는 네트워크 없이 익명 확정 — 401 탐침 소음 제거
    if (!force && !hasSessionHint()) {
      set({ me: null, status: 'anonymous' })
      return Promise.resolve(null)
    }
    if (loadPromise) return loadPromise
    set({ status: 'loading' })
    loadPromise = fetchMe()
      .then((me) => {
        if (me) setSessionHint()
        set({ me, status: me ? 'ready' : 'anonymous' })
        return me
      })
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  },

  ensureSession: () => {
    if (get().status === 'ready' && get().me) return Promise.resolve(get().me)
    if (ensurePromise) return ensurePromise
    set({ status: 'loading' })
    ensurePromise = (async () => {
      // 1) 재방문자 — 401 이면 인터셉터가 /api/auth/token 으로 재발급 후 재시도한다.
      //    (이 경로로만 refresh 쿠키가 전송되므로 게스트 중복 생성이 방지된다)
      let me = await fetchMe()
      // 2) 첫 방문 — 게스트 발급 후 재조회
      if (!me) {
        await createGuestSession()
        me = await fetchMe()
      }
      if (me) setSessionHint()
      set({ me, status: me ? 'ready' : 'anonymous' })
      return me
    })()
      .catch(() => {
        set({ me: null, status: 'anonymous' })
        return null
      })
      .finally(() => {
        ensurePromise = null
      })
    return ensurePromise
  },

  setMe: (me) => set({ me, status: me ? 'ready' : 'anonymous' }),

  clear: () => {
    loadPromise = null
    ensurePromise = null
    clearSessionHint() // 로그아웃·탈퇴 후 재방문 시 불필요한 세션 탐침 방지
    set({ me: null, status: 'idle' })
  },
}))

export const selectIsGuest = (s: UserState) => s.me?.type === 'GUEST'
export const selectIsMember = (s: UserState) => s.me?.type === 'USER'
export const selectCredit = (s: UserState) => s.me?.creditBalance ?? null
