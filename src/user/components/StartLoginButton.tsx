import { Link } from 'react-router-dom'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'

/**
 * /start 퍼널 우측 상단 "로그인" (2026-09-15).
 * 다른 브라우저·카카오톡 인앱처럼 세션이 없는 기존 회원이 광고·링크로 /start 에 떨어지면
 * 맛보기를 다시 풀라는 화면만 보였다. 세션 판정이 끝나고 익명일 때만 보인다 —
 * 로그인 상태면 useTrialFunnelGuard 가 완주 회원을 /home 으로 보내고, 미완주는 퍼널을 그대로 탄다.
 * 로그인 뒤 복귀는 finishLogin 이 정한다 (완주 → /home · 미완주 → 들어왔던 /start 변형).
 * 인트로는 화면 아무 데나 누르면 애니메이션을 건너뛰므로 클릭 전파를 끊는다.
 * 스타일은 랜딩 네비의 고스트 버튼(회색 40%)과 동일.
 */
export default function StartLoginButton() {
  useMe() // 조회 전용(loadMe) — 세션 없는 방문자에게 게스트를 만들지 않는다
  const status = useUserStore((s) => s.status)
  if (status !== 'anonymous') return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-end px-[24px] pt-[calc(var(--safe-top)+14px)] max-md:px-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <Link
        to="/login"
        className="pointer-events-auto flex items-center justify-center whitespace-nowrap rounded-[12px] bg-[rgba(64,70,76,0.4)] p-[12px] text-[16px] font-semibold text-white transition-colors hover:bg-[rgba(64,70,76,0.65)] max-md:rounded-[10px] max-md:p-[8px] max-md:text-[13px]"
      >
        로그인
      </Link>
    </div>
  )
}
