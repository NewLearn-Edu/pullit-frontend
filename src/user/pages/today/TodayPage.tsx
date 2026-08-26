import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchRecommendation } from '@/user/api/recommendApi'
import { useUserStore } from '@/user/stores/userStore'
import type { Subject } from '@/user/stores/trialStore'

/**
 * 오늘의 추천 랜딩 (/today) — 알림톡 버튼·나브 추천 버튼의 공용 진입점 (2026-08-26 정책)
 *
 * - 쿼리 없이 오면(알림톡) 과목 선택 카드 2장 "뭐부터 풀래?"
 * - ?subject=math|english 로 오면(앱 나브 버튼) 선택 뷰를 건너뛰고 바로 추천 계산
 * - 추천은 서버가 라이브로 계산 (박제 없음) → 홈 딥링크(?start=unitCode)로 넘겨
 *   기존 시작 시트·상세 시트 플로우를 그대로 태운다
 */
export default function TodayPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionStatus = useUserStore((s) => s.status)

  const raw = searchParams.get('subject')
  const subject: Subject | null = raw === 'math' || raw === 'english' ? raw : null

  const [error, setError] = useState(false)

  // 로그인 필요 페이지 — 세션 조회를 마쳤는데 아무 세션도 없으면 로그인으로
  useEffect(() => {
    if (sessionStatus === 'anonymous')
      navigate('/login', {
        replace: true,
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  /** 추천 계산 → 홈 딥링크로 이동. 추천 불가(NONE)면 그냥 홈으로 */
  const runRecommend = useCallback(
    async (s: Subject) => {
      setError(false)
      try {
        const rec = await fetchRecommendation(s)
        const params = new URLSearchParams()
        if (s === 'english') params.set('subject', 'english')
        if (rec.type !== 'NONE' && rec.unitCode) params.set('start', rec.unitCode)
        const qs = params.toString()
        navigate(`/home${qs ? `?${qs}` : ''}`, { replace: true })
      } catch {
        setError(true)
      }
    },
    [navigate],
  )

  // 과목이 정해져 있으면(딥링크·카드 선택) 세션 준비되는 대로 바로 계산
  useEffect(() => {
    if (subject && sessionStatus === 'ready') runRecommend(subject)
  }, [subject, sessionStatus, runRecommend])

  const pickSubject = (s: Subject) => {
    setSearchParams({ subject: s }, { replace: true })
  }

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-white px-[24px]">
      {!subject ? (
        // ── 과목 선택 (알림톡 랜딩) ──────────────────────────────────────────
        <div className="flex w-full max-w-[560px] flex-col items-center gap-[32px]">
          <div className="flex flex-col items-center gap-[8px] text-center">
            <h1 className="text-[24px] font-bold leading-[1.4] text-[#121417]">
              오늘의 3문제 도착!
            </h1>
            <p className="text-[15px] font-medium leading-[1.4] text-[#80858b]">뭐부터 풀래?</p>
          </div>

          <div className="grid w-full grid-cols-2 gap-[12px]">
            <SubjectCard
              glyph="π"
              name="수학"
              onClick={() => pickSubject('math')}
            />
            <SubjectCard
              glyph="Aa"
              name="영어"
              onClick={() => pickSubject('english')}
            />
          </div>
        </div>
      ) : error ? (
        // ── 추천 실패 ────────────────────────────────────────────────────────
        <div className="flex w-full max-w-[400px] flex-col items-center gap-[20px] text-center">
          <p className="text-[16px] font-semibold leading-[1.5] text-[#121417]">
            추천 문제를 불러오지 못했어
          </p>
          <div className="flex w-full gap-[8px]">
            <button
              type="button"
              onClick={() => navigate('/home', { replace: true })}
              className="flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#f8f8f8] text-[15px] font-bold text-[#121417]"
            >
              홈으로
            </button>
            <button
              type="button"
              onClick={() => runRecommend(subject)}
              className="flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#23272b] text-[15px] font-bold text-white"
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : (
        // ── 추천 계산 중 ─────────────────────────────────────────────────────
        <div className="flex flex-col items-center gap-[16px]">
          <span
            className="size-[28px] animate-spin rounded-full border-[3px] border-[#e5e7ea] border-t-[#ff385c]"
            aria-hidden
          />
          <p className="text-[15px] font-medium text-[#80858b]">
            딱 맞는 {subject === 'math' ? '수학' : '영어'} 3문제 고르는 중…
          </p>
        </div>
      )}
    </div>
  )
}

/** 과목 선택 카드 — 시안 확정 전 임시 비주얼 (흰 카드 + 대표 글리프) */
function SubjectCard({
  glyph,
  name,
  onClick,
}: {
  glyph: string
  name: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-[16px] rounded-[24px] border border-[#e5e7ea] bg-white transition-colors hover:border-[#121417] active:bg-[#f8f8f8]"
    >
      <span className="flex size-[64px] items-center justify-center rounded-full bg-[#f8f8f8] text-[26px] font-bold text-[#121417]">
        {glyph}
      </span>
      <span className="flex flex-col items-center gap-[4px]">
        <span className="text-[18px] font-bold text-[#121417]">{name}</span>
        <span className="text-[13px] font-medium text-[#80858b]">추천 3문제 풀기</span>
      </span>
    </button>
  )
}
