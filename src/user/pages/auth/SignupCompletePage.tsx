import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCelebrationButton,
  CreditCelebrationContent,
} from '@/user/components/CreditCelebration'
import { resolvePostAuthDestination } from '@/user/services/finishLogin'
import { useUserStore } from '@/user/stores/userStore'

/**
 * 회원가입 완료 축하 (/signup-complete · Figma 3680-6615 · PI-SHEET-SIGNUP-COMPLETE_CREDIT).
 *
 * 시안은 시트 프레임이지만 정책상 가입 직후의 독립 "뷰"로 띄운다 (시트 아님).
 * SignupInfoPage 가 프로필 저장 응답의 welcomeCreditGranted 로 이동시킨다.
 *
 * 확인 → 맛보기(문제 풀이) 기록이 하나도 없으면 /start 퍼널, 있으면 복귀 경로/홈
 * — resolvePostAuthDestination 이 그대로 판정한다.
 */
export default function SignupCompletePage() {
  const navigate = useNavigate()
  const sessionStatus = useUserStore((s) => s.status)
  const [leaving, setLeaving] = useState(false)

  // 비로그인 직접 진입(북마크 등) — 축하할 대상이 없으니 로그인으로
  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', { replace: true })
  }, [sessionStatus, navigate])

  const confirm = async () => {
    if (leaving) return
    setLeaving(true)
    navigate(await resolvePostAuthDestination(), { replace: true })
  }

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
