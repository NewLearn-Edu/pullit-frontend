import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CreditCelebrationButton,
  CreditCelebrationContent,
} from '@/user/components/CreditCelebration'
import { useMe } from '@/user/hooks/useMe'
import { resolvePostAuthDestination } from '@/user/services/finishLogin'
import { useUserStore } from '@/user/stores/userStore'

/**
 * 회원가입 완료 축하 (/signup-complete · Figma 3680-6615 · PI-SHEET-SIGNUP-COMPLETE_CREDIT).
 *
 * 시안은 시트 프레임이지만 정책상 가입 직후의 독립 "뷰"로 띄운다 (시트 아님).
 *
 * 접근은 방금 가입을 마친 그 항해에서만 — SignupInfoPage 가 지급 확인 후
 * state.granted 통행권을 실어 보낸다. URL 직접 진입(통행권 없음)은
 * 로그인 상태면 홈, 비로그인이면 로그인으로 돌려보낸다.
 * (state 는 히스토리에 남아 새로고침에는 유지되고, 떠나면 소멸한다)
 *
 * 확인 → 맛보기(문제 풀이) 기록이 하나도 없으면 /start 퍼널, 있으면 복귀 경로/홈
 * — resolvePostAuthDestination 이 그대로 판정한다.
 */
export default function SignupCompletePage() {
  const navigate = useNavigate()
  const location = useLocation()
  // 세션 조회 트리거 — 이게 없으면 status 가 idle 에 머물러 아래 리다이렉트 판정이 영영 안 돈다
  useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const [leaving, setLeaving] = useState(false)

  const granted = (location.state as { granted?: boolean } | null)?.granted === true

  useEffect(() => {
    if (granted) return
    // 통행권 없는 진입 — 세션 판정이 끝나길 기다렸다가 각자 자리로
    if (sessionStatus === 'anonymous') navigate('/login', { replace: true })
    else if (sessionStatus === 'ready') navigate('/home', { replace: true })
  }, [granted, sessionStatus, navigate])

  const confirm = async () => {
    if (leaving) return
    setLeaving(true)
    navigate(await resolvePostAuthDestination(), { replace: true })
  }

  // 통행권 없이 온 진입은 리다이렉트 판정 동안 아무것도 그리지 않는다 (축하 화면 깜빡임 방지)
  if (!granted) return null

  // signup/info 와 같은 골격 — 콘텐츠는 중앙, 확인 버튼은 화면 맨 아래 footer
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <main className="flex w-full flex-1 flex-col items-center justify-center px-[20px]">
        <div className="flex w-full max-w-[620px] flex-col items-center gap-[16px]">
          {/* 안내 문구 없음 — 가입 완료 뷰는 타이틀·금액만 (message="" 로 줄 제거) */}
          <CreditCelebrationContent
            title="회원가입 선물 도착!"
            message=""
            withButton={false}
            onConfirm={confirm}
          />
        </div>
      </main>
      <footer className="flex w-full shrink-0 items-start justify-center px-[40px] pb-[48px] pt-[16px] max-md:px-lg max-md:pb-[calc(32px+env(safe-area-inset-bottom))]">
        <CreditCelebrationButton onConfirm={confirm} />
      </footer>
    </div>
  )
}
