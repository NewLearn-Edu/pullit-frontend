import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import TrialIntroPage from './TrialIntroPage'
import { InAppBrowserGate } from '@/user/components/InAppBrowserGate'
import { getStartVariant, rememberStartPath } from '@/user/services/startVariants'

/**
 * /start · /start/:variant 공용 진입 (2026-09-09).
 * 등록된 변형이면 그 화면, 아니면 기본 인트로 — 어느 쪽이든 주소는 바꾸지 않는다 (utm · landing_path 보존).
 * 변형 경로는 기억해 두어 로그인·가입 뒤 퍼널 복귀가 같은 변형으로 돌아온다.
 * 변형은 광고 전용이라 검색엔진에 중복 랜딩으로 잡히지 않게 noindex.
 */
export default function StartVariantPage() {
  const { variant } = useParams<{ variant?: string }>()
  const pathname = variant ? `/start/${variant}` : '/start'
  const registered = getStartVariant(variant)

  useEffect(() => {
    rememberStartPath(pathname)
  }, [pathname])

  useEffect(() => {
    if (!variant) return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [variant])

  if (variant && registered?.component) {
    const Variant = registered.component
    return (
      <>
        <Variant slug={variant} />
        <InAppBrowserGate />
      </>
    )
  }
  // 광고 랜딩 — 인스타·페이스북 인앱 브라우저면 외부 브라우저 안내 시트를 위에 띄운다 (2026-09-10)
  return (
    <>
      <TrialIntroPage />
      <InAppBrowserGate />
    </>
  )
}
