import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '@/user/components/ConfirmDialog'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { RecommendIcon } from '@/user/components/icons/RecommendIcon'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { Skeleton } from '@/user/components/Skeleton'
import { type Subject } from '@/user/stores/trialStore'
import { fetchUnitLocks } from '@/user/api/recommendApi'
import { fetchResumableSet, type ResumableSet } from '@/user/api/problemSetApi'
import { useMe } from '@/user/hooks/useMe'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { useUserStore } from '@/user/stores/userStore'
import { computeCategoryProgress, useTrialProgressStore } from '@/user/stores/trialProgressStore'
import { CURRICULUM, UNIT_LABEL } from '@/user/data/curriculum'
import ProgressRadar from '@/user/components/WeaknessRadar/ProgressRadar'
import graphExample from '@/assets/home/graph-example.png'
import { useUnitSheets } from './UnitSheets'
import styles from './styles/HomePage.module.scss'

/** 맛보기 세트 문항 수 — 정책 3문항 */
const SET_SIZE = 3

/**
 * 이어풀기 팝업 24시간 쿨다운 (2026-09-02) — 매 홈 진입마다 뜨면 피로해서,
 * 한 번 띄우면 24시간 안에는 다시 안 띄운다. 노출 자체의 스로틀이라 서버
 * 진실원(풀다 만 세트)과 무관 — 카드의 "풀다 만 문제가 있어" 라벨이 상시 안내를 맡는다.
 * QA: ?qa-reset 으로 초기화 (main.tsx)
 */
const RESUME_PROMPT_SHOWN_AT_KEY = 'pullit_resume_prompt_shown_at'
const RESUME_PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000

function resumePromptCoolingDown(): boolean {
  const at = Number(localStorage.getItem(RESUME_PROMPT_SHOWN_AT_KEY))
  return Number.isFinite(at) && at > 0 && Date.now() - at < RESUME_PROMPT_COOLDOWN_MS
}

/** unitCode 로 커리큘럼 유닛 찾기 — 팝업의 세트 과목이 현재 탭과 달라도 복원 가능해야 한다 */
function findUnitByCode(subject: Subject, unitCode: string) {
  for (const category of CURRICULUM[subject]) {
    const unit = category.units.find((u) => u.unitCode === unitCode)
    if (unit) return unit
  }
  return null
}

/**
 * 메인 홈 (Figma PI-PAGE-04 · 2431-17022 · 2026-08-07 개편)
 * 약점 그래프(잠금 레이더 차트) + 대분류 칩 + 소단원 리스트.
 * 모바일 시안 기준 — 데스크탑은 사이드바 유지 + 콘텐츠 620px 중앙 정렬.
 */
export default function HomePage() {
  const navigate = useNavigate()
  const diagnosed = useTrialProgressStore((s) => s.diagnosed)
  const hydrateFromServer = useTrialProgressStore((s) => s.hydrateFromServer)
  const { me } = useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const credit = me?.creditBalance ?? 0

  // 서버 동기화(진단 기록 + 잠금) 완료 전에는 그래프·리스트 자리에 스켈레톤 —
  // 빈 데이터를 실물처럼 그렸다가 갈아끼우는 깜빡임(미진단 → 점수)을 없앤다
  const [synced, setSynced] = useState(false)

  // 홈은 세션(게스트·회원)이 있어야 하는 페이지 — 조회를 마쳤는데 아무 세션도 없으면 로그인으로
  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        // 로그인 후 이 페이지로 복귀 (LoginPage 가 postLoginRedirect 로 저장)
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  // 프로필 미완성 회원은 추가 정보 입력부터 (연령 게이트 — 생년월일·전화번호·약관)
  useEffect(() => {
    if (me?.type === 'USER' && (!me.phoneNumber || !me.birthDate)) {
      navigate('/signup/info', { replace: true })
    }
  }, [me, navigate])

  // 맛보기 완주 게이트는 회원 영역 공용 가드(RequireTrialDone, App.tsx)가 담당

  // 과목 탭·대분류 칩은 URL 쿼리가 진실원 — 언락 등에서 뒤로가기로 돌아와도 상태가 복원된다
  const [searchParams, setSearchParams] = useSearchParams()
  const subject: Subject = searchParams.get('subject') === 'english' ? 'english' : 'math'
  const catSlug = searchParams.get('cat') ?? CURRICULUM[subject][0].slug

  const [infoOpen, setInfoOpen] = useState(false) // 약점 그래프 예시 안내 (? 버튼)
  // 인포 시트 아래로 스와이프 닫기 — 웹은 중앙 다이얼로그라 제스처 제외
  const infoDrag = useSheetDrag(() => setInfoOpen(false), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })

  // replace — 탭/칩 전환이 히스토리 스택에 쌓이지 않게 (뒤로가기 한 번에 홈 이탈)
  const changeSubject = (s: Subject) => {
    setSearchParams(s === 'math' ? {} : { subject: s }, { replace: true })
  }
  const changeCat = (slug: string) => {
    const next: Record<string, string> = slug === CURRICULUM[subject][0].slug ? {} : { cat: slug }
    if (subject !== 'math') next.subject = subject
    setSearchParams(next, { replace: true })
  }

  const categories = CURRICULUM[subject]
  const category = categories.find((c) => c.slug === catSlug) ?? categories[0]

  // "안배웠어요" 잠금 — 서버(unit_locks)가 진실원. 유닛코드 → off 시작점 매핑
  const [locks, setLocks] = useState<Record<string, string>>({}) // categoryCode → offFromUnitCode
  const refreshLocks = useCallback(
    () =>
      fetchUnitLocks(subject)
        .then((list) => {
          const map: Record<string, string> = {}
          for (const lock of list) map[lock.categoryCode] = lock.offFromUnitCode
          setLocks(map)
        })
        .catch(() => {}),
    [subject],
  )

  // 소단원 진행 상태의 진실원은 서버(trial_diagnoses) — 세션 확보 후 잠금과 함께 동기화.
  // 실패해도 스켈레톤에 갇히지 않게 settled 기준으로 연다 (그때는 로컬 상태 폴백)
  useEffect(() => {
    if (sessionStatus !== 'ready') return
    let alive = true
    Promise.allSettled([hydrateFromServer(), refreshLocks()]).then(() => {
      if (alive) setSynced(true)
    })
    return () => {
      alive = false
    }
  }, [sessionStatus, hydrateFromServer, refreshLocks])

  const categoryCodeOf = (cat: (typeof categories)[number]) =>
    cat.units[0].unitCode.split('_').slice(0, 3).join('_')
  const progress = computeCategoryProgress(
    category,
    diagnosed,
    locks[categoryCodeOf(category)] ?? null,
  )
  const unitLabel = UNIT_LABEL[subject]

  // 소단원 액션 시트 묶음 — 약점 지도와 공용 (UnitSheets.tsx)
  const sheets = useUnitSheets({
    subject,
    credit,
    returnTo: () => `/home${window.location.search}`,
    onLocksChanged: refreshLocks,
    // 진단 완료 토스트 "보기" (3575-7884) — 단원명으로 전 대분류에서 행을 찾아 상세 시트
    resolveUnit: (name) => {
      for (const cat of categories) {
        const rows = computeCategoryProgress(cat, diagnosed, locks[categoryCodeOf(cat)] ?? null).rows
        const row = rows.find((r) => r.name === name)
        if (row) return { row, context: { category: cat, rows } }
      }
      return null
    },
  })
  const sheetCtx = { category, rows: progress.rows }

  /** 레이더 축 라벨 클릭 → 아래 소단원 카드로 부드럽게 스크롤 (Figma 2842-11896 리스트) */
  const scrollToUnitCard = (name: string) => {
    document
      .querySelector(`[data-unit-card="${CSS.escape(name)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  /**
   * 약점 그래프 해제 (Figma 2842-8069 · 2026-08-20 개편) —
   * 이 대단원에서 하나라도 진단했으면 그래프 공개, 아니면 잠금 오버레이.
   */
  const hasAnyDiagnosis = progress.rows.some((r) => r.diagnosis)


  // ── 이어풀기 팝업 (PI-POPUP-RESUME · Figma 2931-11007) ──────────────────
  // 풀다 만 세트가 있으면 띄우되 24시간에 1회만 (쿨다운 상수 참조).
  // 추천 로직과 무관 — 추천은 ①진단→②최약점 그대로, 재개 안내는 이 팝업의 몫
  // 데이터(resumableSet)와 팝업 노출(resumePromptOpen)을 분리 — 팝업을 취소해도
  // 소단원 카드의 "이어풀기" 라벨(2919-8829)은 계속 보여야 한다
  const [resumableSet, setResumableSet] = useState<ResumableSet | null>(null)
  const [resumePromptOpen, setResumePromptOpen] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null) // 이어풀기 실패 안내 팝업
  useEffect(() => {
    if (sessionStatus !== 'ready') return
    let alive = true
    fetchResumableSet()
      .then((resumable) => {
        if (!alive) return
        setResumableSet(resumable)
        if (resumable && !resumePromptCoolingDown()) {
          localStorage.setItem(RESUME_PROMPT_SHOWN_AT_KEY, String(Date.now()))
          setResumePromptOpen(true)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [sessionStatus])

  const handleResume = async () => {
    const info = resumableSet
    if (!info) return
    setResumePromptOpen(false)
    const subj: Subject = info.subject === 'ENGLISH' ? 'english' : 'math'
    const unit = findUnitByCode(subj, info.unitCode)
    if (!unit) return
    try {
      if (info.source === 'TRIAL') await sheets.startTrialSet(unit, subj)
      else await sheets.startFreeSolve(unit, subj)
    } catch (error) {
      setResumeError(extractApiMessage(error) ?? '이어풀기에 실패했어. 다시 시도해줘')
    }
  }



  return (
    <div className={styles.page}>
      <UserNav active="recommend" />

      <main className={styles.main}>
        {/* 상단 헤더 — 크레딧 · 과목 토글 · 오답노트/마이 */}
        <PageHeader
          left={<CreditBadge credit={credit} />}
          center={<SubjectTabs pill value={subject} onChange={changeSubject} />}
          hideRightOnDesktop
          right={
            <>
              <button
                type="button"
                aria-label="오답노트"
                onClick={() => navigate('/wrong-note')}
                className={styles.iconCircle}
              >
                <WrongNoteIcon />
              </button>
            </>
          }
        />

        <div className={styles.content}>
          <h1 className={styles.title}>약점 그래프</h1>

          {/* 대분류 칩 */}
          <div className={styles.chips}>
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => changeCat(c.slug)}
                className={clsx(styles.chip, category.slug === c.slug && styles.chipActive)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* 서버 동기화 전 — 그래프·리스트 자리 스켈레톤 (같은 크기라 도착 시 점프 없음) */}
          {!synced && (
            <>
              <Skeleton style={{ marginTop: 16, height: 360 }} />
              <section className={styles.subSection}>
                <h2 className={styles.subTitle}>{unitLabel}</h2>
                <div className="flex flex-col gap-[8px]">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} style={{ height: 77 }} />
                  ))}
                </div>
              </section>
            </>
          )}

          {/* 약점 그래프 카드 (Figma 2919-8728) — 흰 카드 안 레이더.
              이 대단원에서 하나도 진단 전이면 다크 잠금 오버레이 (2842-8069) */}
          {synced && (
          <div className={styles.graphShell}>
            <ProgressRadar
              key={`${subject}:${category.slug}`} // 탭·카테고리 전환 시 리마운트 — 진입 애니메이션 재생
              units={progress.rows.map((u) => ({
                name: u.name,
                score: u.diagnosis?.score, // undefined = 미진단 (점선 슬롯 + 미진단 라벨)
              }))}
              className={styles.graphSvg}
              onSelectUnit={scrollToUnitCard}
            />

            {hasAnyDiagnosis ? (
              // 열린 그래프 — ? 안내 버튼만 우상단에
              <button
                type="button"
                aria-label="약점 그래프 안내"
                onClick={() => setInfoOpen(true)}
                className={styles.helpChip}
              >
                ?
              </button>
            ) : (
              <div className={styles.graphOverlay}>
                <button
                  type="button"
                  aria-label="약점 그래프 안내"
                  onClick={() => setInfoOpen(true)}
                  className={clsx(styles.helpChip, styles.helpChipOverlay)}
                >
                  ?
                </button>
                <div className={styles.graphOverlayBody}>
                  <LockKeyholeIcon />
                  <p className={styles.graphOverlayTitle}>약점 그래프 잠김</p>
                  <p className={styles.graphOverlayDesc}>
                    {unitLabel} 한 개만 진단하면 바로 열려
                  </p>
                </div>
              </div>
            )}
          </div>
          )}

          {/* 소단원(수학) / 유형(영어) 카드 리스트 (Figma subject-card 3종) */}
          {synced && (
          <section className={styles.subSection}>
            <h2 className={styles.subTitle}>{unitLabel}</h2>

            <ol className={styles.unitCards}>
              {progress.rows.map((row) => {
                if (row.state === 'off') {
                  // 건너뛴 단원 — 개별 카드 (3693-8663 개정: 잠금 스택·자물쇠 폐지).
                  // bg black/300 + "건너뜀" 필. 시작 소단원(offHead) 클릭 = 재진단 시트,
                  // 나머지 = 잠금 안내 시트 (분기는 sheets.openUnit 이 담당)
                  return (
                    <li key={row.name} data-unit-card={row.name}>
                      <button
                        type="button"
                        onClick={() => sheets.openUnit(row, sheetCtx)}
                        className={clsx(styles.unitCard, styles.unitCardSkipped)}
                      >
                        <span className={styles.unitCardNameSkipped}>{row.name}</span>
                        <span className={styles.unitStatePill}>건너뜀</span>
                      </button>
                    </li>
                  )
                }
                if (row.diagnosis) {
                  // 진단 완료 — 흰 카드 · 메타 · 점수 + 셰브런 (상세 시트)
                  const total = row.diagnosis.items?.length ?? SET_SIZE
                  return (
                    <li key={row.name} data-unit-card={row.name}>
                      <button
                        type="button"
                        onClick={() => sheets.openUnit(row, sheetCtx)}
                        className={clsx(styles.unitCard, styles.unitCardTap, styles.unitCardDone)}
                      >
                        <span className={styles.unitCardBody}>
                          <span className={styles.unitCardNameRow}>
                            <span className={styles.unitCardName}>{row.name}</span>
                            {/* 약점 필 없음 — 점수 색(빨강)이 약점 표시를 맡는다 (마스터 카드 2246-6010) */}
                            {/* 풀다 만 세트(자유 풀이 등)가 있는 단원 — 이어풀기 안내 (시안 3681) */}
                            {resumableSet?.unitCode === row.unitCode && (
                              <span className={styles.unitResumeLabel}>풀다 만 문제가 있어</span>
                            )}
                          </span>
                          <span className={styles.unitCardMeta}>
                            <CheckCircleIcon />
                            푼 문제 수 {total}개
                            <span className={styles.unitMetaDivider} />
                            <ClockIcon />
                            {row.diagnosis.minutes}분
                          </span>
                        </span>
                        <span
                          className={clsx(
                            styles.unitCardScore,
                            row.diagnosis.weak && styles.unitCardScoreWeak,
                          )}
                        >
                          {row.diagnosis.score}점
                        </span>
                        <span className={styles.unitCardChevron} aria-hidden>
                          <ChevronIcon />
                        </span>
                      </button>
                    </li>
                  )
                }
                if (row.state === 'next') {
                  // 다음 차례 — 흰 카드 + 빨간 보더 + 진단하기 버튼 → 진단 시작 시트
                  return (
                    <li key={row.name} data-unit-card={row.name}>
                      {/* 카드 전체가 버튼 — 안쪽 알약은 표식이라 span (버튼 중첩 불가) */}
                      <button
                        type="button"
                        onClick={() => sheets.openUnit(row, sheetCtx)}
                        className={clsx(styles.unitCard, styles.unitCardTap, styles.unitCardNext)}
                      >
                        <span className={styles.unitCardName}>{row.name}</span>
                        <span className={styles.unitDiagnoseBtn}>
                          {resumableSet?.source === 'TRIAL' &&
                          resumableSet.unitCode === row.unitCode
                            ? '이어풀기'
                            : '진단하기'}
                        </span>
                      </button>
                    </li>
                  )
                }
                // 잠김 — 회색 카드 + 자물쇠 → 선행 단원 안내 시트 (3082-5687)
                return (
                  <li key={row.name} data-unit-card={row.name}>
                    <button
                      type="button"
                      onClick={() => sheets.openUnit(row, sheetCtx)}
                      className={clsx(styles.unitCard, styles.unitCardLocked)}
                    >
                      <span className={styles.unitCardNameLocked}>{row.name}</span>
                      {/* 마스터 카드(2246-6010) — 순서 잠김은 자물쇠 대신 "미진단" 필 */}
                      <span className={styles.unitStatePill}>미진단</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
          )}
        </div>

        {/*
          웹 전용 추천 문제 진입점 — 모바일·패드는 하단 네비의 추천 FAB 가 같은 역할을 해서
          도크를 띄우지 않는다 (시안 3450-8896 적용, 2026-08-27).
          목적지는 나브 FAB 와 동일한 /recommend · 지금 보고 있는 과목을 그대로 넘긴다.
        */}
        <div className={styles.solveDock}>
          <button
            type="button"
            className={styles.solveDockCta}
            onClick={() => navigate(`/recommend?subject=${subject}`)}
          >
            {/* size 42 → 글리프 약 26px · 문제지 면이 16px 텍스트와 비슷한 높이가 된다 */}
            <RecommendIcon size={42} />
            추천 문제
          </button>
        </div>
      </main>

      {/* 약점 그래프 예시 안내 (Figma 2504-22065) — ? 버튼 시트 */}
      {infoOpen && (
        <div className={styles.infoDim} onClick={infoDrag.close}>
          <div
            {...infoDrag.sheetProps}
            className={clsx(styles.infoSheet, infoDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={infoDrag.close}
              className={styles.infoHandleWrap}
            >
              <span className={styles.infoHandle} />
            </button>
            <h2 className={styles.infoTitle}>약점 그래프 예시</h2>
            <p className={styles.infoDesc}>
              여기까지만 하면, 다음부턴 풀잇이 알아서 해.
              <br />네 약점에 딱 맞는 {SET_SIZE}문제를 매일 아침 준비해둘게
            </p>
            <div className={styles.infoCard}>
              <img src={graphExample} alt="약점 그래프 예시" className={styles.infoImage} />
            </div>
            <button type="button" onClick={infoDrag.close} className={styles.infoClose}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 소단원 액션 시트 4종 + 크레딧 부족 팝업 — 약점 지도와 공용 (UnitSheets) */}
      {sheets.element}

      {resumeError && <ConfirmDialog title={resumeError} onConfirm={() => setResumeError(null)} />}

      {/* ── 이어풀기 팝업 (PI-POPUP-RESUME · 2931-11007) — 앱 진입 시 풀다 만 세트 안내 ── */}
      {resumePromptOpen && resumableSet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-prompt-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.2)] px-[20px]"
        >
          <div className="flex w-[335px] flex-col items-center gap-[16px] rounded-[24px] bg-white px-[20px] py-[34px] shadow-[0px_0px_7px_rgba(0,0,0,0.21)]">
            <h2
              id="resume-prompt-title"
              className="text-[18px] font-bold leading-[1.4] text-[#121417]"
            >
              풀던 문제가 남아 있어
            </h2>
            <div className="flex w-full flex-col items-center gap-[24px]">
              <p className="text-center text-[16px] font-medium leading-[1.4] text-[#121417]">
                남은 문제부터 바로 시작할 수 있어
              </p>
              <div className="flex w-full gap-[8px]">
                <button
                  type="button"
                  onClick={() => setResumePromptOpen(false)}
                  className="flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#f8f8f8] text-[16px] font-bold text-[#121417]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleResume}
                  className="flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90"
                >
                  이어풀기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 서버 에러 응답(BaseResponse.message) 우선 추출 — 크레딧 부족 등 서버 문구를 그대로 보여준다 */
function extractApiMessage(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const res = (error as { response?: { data?: { message?: string } } }).response
    return res?.data?.message ?? null
  }
  return null
}

/* --- 인라인 SVG 아이콘 (소단원 카드 메타 · Figma subject-card) --- */

/** 잠금 오버레이 자물쇠 (Figma lock-keyhole 80px) — 회색 고리 + 몸통 + 열쇠구멍 */
function LockKeyholeIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden>
      <path
        d="M25 41V30.5C25 22.4 31.7 16 40 16s15 6.4 15 14.5V41"
        stroke="#d6d8db"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="18" y="35" width="44" height="30" rx="6" fill="#80858b" />
      <circle cx="40" cy="46.5" r="4" fill="#f0f1f3" />
      <rect x="38" y="48" width="4" height="8.5" rx="2" fill="#f0f1f3" />
    </svg>
  )
}

function CheckCircleIcon() {
  // Figma check-circle_svgrepo.com 원본 — 채운 원 + 체크 (subject-card 2842-11896)
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M12.8333 7C12.8333 10.2216 10.2216 12.8333 7 12.8333C3.77834 12.8333 1.16667 10.2216 1.16667 7C1.16667 3.77834 3.77834 1.16667 7 1.16667C10.2216 1.16667 12.8333 3.77834 12.8333 7Z"
        fill="#D6D8DB"
      />
      <path
        d="M9.35101 5.23231C9.52187 5.40316 9.52187 5.68017 9.35101 5.85101L6.43434 8.76768C6.26348 8.93853 5.98652 8.93853 5.81564 8.76768L4.64897 7.60101C4.47812 7.43015 4.47812 7.15318 4.64897 6.98232C4.81983 6.81147 5.09684 6.81147 5.26769 6.98232L6.125 7.83959L7.42863 6.53596L8.73232 5.23231C8.90318 5.06146 9.18015 5.06146 9.35101 5.23231Z"
        fill="#5E6368"
      />
    </svg>
  )
}

function ClockIcon() {
  // Figma clock-circle_svgrepo.com 원본 — 채운 원 + 시계바늘 (subject-card 2842-11896)
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 12.8333C10.2216 12.8333 12.8333 10.2216 12.8333 7C12.8333 3.77834 10.2216 1.16667 7 1.16667C3.77834 1.16667 1.16667 3.77834 1.16667 7C1.16667 10.2216 3.77834 12.8333 7 12.8333Z"
        fill="#D6D8DB"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 4.22917C7.24162 4.22917 7.4375 4.42504 7.4375 4.66667V6.81876L8.76768 8.14899C8.93853 8.31985 8.93853 8.59682 8.76768 8.76767C8.59682 8.93853 8.31985 8.93853 8.14899 8.76767L6.69066 7.30934C6.60858 7.22732 6.5625 7.11602 6.5625 7V4.66667C6.5625 4.42504 6.75838 4.22917 7 4.22917Z"
        fill="#5E6368"
      />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}



