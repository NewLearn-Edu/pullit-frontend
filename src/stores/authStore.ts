/**
 * @deprecated 실제 세션 권한은 src/user/stores/userStore.ts (me.role) 가 담당한다.
 * 이 스텁은 참조가 0건이며, 게스트 인증 도입(2026-08-06) 때 UserNav 가 userStore 로 이전됐다.
 */
import { create } from 'zustand'

export type UserRole = 'admin' | 'student'

interface AuthState {
  role: UserRole
  setRole: (role: UserRole) => void
}

/**
 * 로그인 연동 전 임시 스텁 — 백엔드 인증이 붙으면 로그인 응답의 권한으로 교체.
 * role 이 'admin' 이 아니면 /admin/* 진입 시 홈으로 리다이렉트된다.
 */
export const useAuthStore = create<AuthState>((set) => ({
  role: 'admin',
  setRole: (role) => set({ role }),
}))
