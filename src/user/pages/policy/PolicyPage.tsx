import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PageHeader } from '@/user/components/PageHeader/PageHeader'
import { fetchPolicy, type Policy, type PolicySlug } from '@/user/api/policyApi'

const VALID_SLUGS: PolicySlug[] = ['terms', 'privacy', 'marketing']

/**
 * 법적 고지문 열람 (/policies/:slug — terms · privacy · marketing)
 *
 * 어드민이 게시한 현재 시행 버전을 마크다운으로 렌더한다.
 * react-markdown 은 마크다운 속 raw HTML 을 렌더하지 않으므로(XSS 차단)
 * 별도 sanitize 없이 안전하다. 표는 remark-gfm 으로 지원.
 */
export default function PolicyPage() {
  const { slug } = useParams<{ slug: string }>()
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [failed, setFailed] = useState(false)

  const validSlug = VALID_SLUGS.includes(slug as PolicySlug) ? (slug as PolicySlug) : null

  useEffect(() => {
    if (!validSlug) return
    let alive = true
    setPolicy(null)
    setFailed(false)
    fetchPolicy(validSlug)
      .then((data) => alive && setPolicy(data))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [validSlug])

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PageHeader backTo="history" />

      <main className="mx-auto w-full max-w-[660px] flex-1 px-lg pb-[64px] pt-[8px]">
        {failed || !validSlug ? (
          <p className="pt-[40px] text-center text-[15px] text-[#80858b]">
            문서를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </p>
        ) : !policy ? null : (
          <article className="policy-doc">
            <h1 className="text-[24px] font-bold leading-[1.4] text-[#121417]">{policy.title}</h1>
            <p className="mt-[8px] text-[13px] text-[#a6abb1]">
              시행일 {policy.effectiveAt.slice(0, 10)}
            </p>
            <div className="mt-[28px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{policy.content}</ReactMarkdown>
            </div>
          </article>
        )}
      </main>
    </div>
  )
}
