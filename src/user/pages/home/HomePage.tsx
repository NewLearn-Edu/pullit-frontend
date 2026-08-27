import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { ProfileIcon } from '@/user/components/icons/NavIcons'
import { RecommendIcon } from '@/user/components/icons/RecommendIcon'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { useTrialStore, type Subject } from '@/user/stores/trialStore'
import { useCreditForExtraSet } from '@/user/api/creditApi'
import { declareUnitLock, fetchUnitLocks } from '@/user/api/recommendApi'
import { useMe } from '@/user/hooks/useMe'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { useUserStore } from '@/user/stores/userStore'
import { useSolveStore } from '@/user/stores/solveStore'
import { loadQuizProblems } from '@/user/services/problemSet'
import {
  computeCategoryProgress,
  SET_CREDIT_COST,
  useTrialProgressStore,
  type UnitProgressRow,
} from '@/user/stores/trialProgressStore'
import { CURRICULUM, UNIT_LABEL } from '@/user/data/curriculum'
import ProgressRadar from '@/user/components/WeaknessRadar/ProgressRadar'
import graphExample from '@/assets/home/graph-example.png'
import styles from './styles/HomePage.module.scss'

/** 맛보기 세트 문항 수 — 정책 3문항 */
const SET_SIZE = 3

/**
 * 메인 홈 (Figma PI-PAGE-04 · 2431-17022 · 2026-08-07 개편)
 * 약점 그래프(잠금 레이더 차트) + 대분류 칩 + 소단원 리스트.
 * 모바일 시안 기준 — 데스크탑은 사이드바 유지 + 콘텐츠 620px 중앙 정렬.
 */
export default function HomePage() {
  const navigate = useNavigate()
  const diagnosed = useTrialProgressStore((s) => s.diagnosed)
  const startUnit = useTrialProgressStore((s) => s.startUnit)
  const hydrateFromServer = useTrialProgressStore((s) => s.hydrateFromServer)
  const { me } = useMe()
  const loadMe = useUserStore((s) => s.loadMe)
  const sessionStatus = useUserStore((s) => s.status)
  const credit = me?.creditBalance ?? 0

  // 소단원 진행 상태의 진실원은 서버(trial_diagnoses) — 세션 확보 후 동기화
  useEffect(() => {
    if (sessionStatus === 'ready') hydrateFromServer()
  }, [sessionStatus, hydrateFromServer])

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

  // 진단 완료 유닛 상세 시트 (Figma 2857-22101) — 요약 통계 + 최근 학습 + CTA
  const [unitSheet, setUnitSheet] = useState<UnitProgressRow | null>(null)
  const unitDrag = useSheetDrag(() => setUnitSheet(null), {
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
  const refreshLocks = useCallback(() => {
    fetchUnitLocks(subject)
      .then((list) => {
        const map: Record<string, string> = {}
        for (const lock of list) map[lock.categoryCode] = lock.offFromUnitCode
        setLocks(map)
      })
      .catch(() => {})
  }, [subject])
  useEffect(() => {
    if (sessionStatus === 'ready') refreshLocks()
  }, [sessionStatus, refreshLocks])

  const categoryCodeOf = (cat: (typeof categories)[number]) =>
    cat.units[0].unitCode.split('_').slice(0, 3).join('_')
  const progress = computeCategoryProgress(
    category,
    diagnosed,
    locks[categoryCodeOf(category)] ?? null,
  )
  const unitLabel = UNIT_LABEL[subject]

  // ── 진단 시작 시트 (Figma 2842-10194) + 잠금 확인 + 선행 안내(3082-5687) ──
  const [startSheet, setStartSheet] = useState<UnitProgressRow | null>(null)
  const [skipMode, setSkipMode] = useState(false) // 시작 시트 안에서 잠금 확인 화면으로 전환
  const [lockedSheet, setLockedSheet] = useState<UnitProgressRow | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const closeStartSheet = () => {
    setStartSheet(null)
    setSkipMode(false)
    setStartError(null)
  }
  const startDrag = useSheetDrag(closeStartSheet, {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })
  const lockedDrag = useSheetDrag(() => setLockedSheet(null), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })

  const openStartSheet = (row: UnitProgressRow | undefined) => {
    if (!row) return
    setSkipMode(false)
    setStartError(null)
    setStartSheet(row)
  }

  // 추천 딥링크 (?start=unitCode) — /today(알림톡·나브 추천 버튼)가 넘겨준 유닛의
  // 시트를 상태에 맞게 자동으로 연다. 대분류 칩이 다르면 먼저 맞춘 뒤 재실행된다.
  useEffect(() => {
    if (sessionStatus !== 'ready') return
    const startCode = searchParams.get('start')
    if (!startCode) return
    const targetCat = categories.find((c) => c.units.some((u) => u.unitCode === startCode))
    const next = new URLSearchParams(searchParams)
    if (targetCat && targetCat.slug !== category.slug) {
      if (targetCat.slug === categories[0].slug) next.delete('cat')
      else next.set('cat', targetCat.slug)
      setSearchParams(next, { replace: true }) // cat 이 바뀌면 이 effect 가 다시 돈다
      return
    }
    next.delete('start')
    setSearchParams(next, { replace: true })
    const row = progress.rows.find((r) => r.unitCode === startCode)
    if (!row) return
    if (row.state === 'done') setUnitSheet(row)
    else if (row.state === 'next' || (row.state === 'off' && row.offHead)) openStartSheet(row)
    else setLockedSheet(row)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, searchParams, setSearchParams, categories, category.slug, progress.rows])

  // 예상 시간 — 세트 문항의 권장 시간 합 (문제 세트 캐시 공유라 보통 즉시)
  const [estimatedSec, setEstimatedSec] = useState<number | null>(null)
  useEffect(() => {
    setEstimatedSec(null)
    if (!startSheet) return
    let alive = true
    loadQuizProblems(
      subject,
      startSheet.nodeId ?? (subject === 'math' ? 'sn-exp-log-01' : 'en-blank'),
    ).then((problems) => {
      if (alive && problems.length > 0)
        setEstimatedSec(problems.reduce((s, p) => s + p.tRecSec, 0))
    })
    return () => {
      alive = false
    }
  }, [startSheet, subject])

  const resetTrial = useTrialStore((s) => s.reset)
  const setLastSubject = useTrialStore((s) => s.setLastSubject)
  const setMathSkillNode = useTrialStore((s) => s.setMathSkillNode)
  const setEnglishType = useTrialStore((s) => s.setEnglishType)

  /** 시작하기 — 서버 크레딧 차감 성공 시에만 퀴즈 진입 (UnlockProgressPage 와 동일 규칙) */
  const confirmStartSet = async () => {
    if (!startSheet || starting) return
    setStarting(true)
    setStartError(null)
    try {
      await useCreditForExtraSet()
      loadMe(true)
      resetTrial()
      setLastSubject(subject)
      const nodeId = startSheet.nodeId ?? (subject === 'math' ? 'sn-exp-log-01' : 'en-blank')
      if (subject === 'math') setMathSkillNode(nodeId)
      else setEnglishType(nodeId)
      startUnit({ unitName: startSheet.name, returnTo: `/home${window.location.search}` })
      navigate(`/trial/quiz/${subject}/0`)
    } catch {
      setStartError('크레딧 사용에 실패했어. 잔액을 확인하고 다시 시도해줘')
      setStarting(false)
    }
  }

  /**
   * "안배웠어요" 확정 (2026-08-26 정책) — 이 소단원부터 대단원 끝까지 서버에 잠금 선언.
   * 해제는 잠금 시작 소단원을 다시 풀어 박제될 때 서버가 자동 처리.
   */
  const [lockSaving, setLockSaving] = useState(false)
  const confirmSkip = async () => {
    if (!startSheet || lockSaving) return
    setLockSaving(true)
    try {
      await declareUnitLock(subject, startSheet.unitCode)
      refreshLocks()
      closeStartSheet()
    } catch {
      setStartError('잠금 저장에 실패했어. 다시 시도해줘')
    } finally {
      setLockSaving(false)
    }
  }

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

  /**
   * 자유 풀이 (2026-08-13 정책) — 대단원 진단을 모두 마쳐야(unlocked) 열린다.
   * 열려 있으면 해당 유닛 문제로 FREE 세션을 만들어 /solve 로 진입.
   */
  const startSolveSession = useSolveStore((s) => s.startSession)
  const startFreeSolve = async (row: UnitProgressRow) => {
    const problems = await loadQuizProblems(
      subject,
      row.nodeId ?? (subject === 'math' ? 'sn-exp-log-01' : 'en-blank'),
    )
    if (problems.length === 0) return
    startSolveSession({
      problems,
      source: 'FREE',
      returnTo: `/home${window.location.search}`,
    })
    navigate(`/solve/${subject}/0`)
  }

  /**
   * 잠긴 카드 안내 시트의 "먼저 풀어야 할" 유닛 —
   * off 구간(안배웠어요)은 잠금 시작 소단원(offHead), 순서 잠금은 다음 진단 유닛.
   */
  const lockedIsOff = lockedSheet?.state === 'off'
  const lockedRequired = lockedIsOff
    ? progress.rows.find((r) => r.offHead)
    : progress.nextUnit

  /** 유닛 시트 요약값 — 문항별 기록이 있으면 초 단위 합산, 없으면(구버전) 분 근사 */
  const sheetItems = unitSheet?.diagnosis?.items ?? []
  const sheetTotal = sheetItems.length > 0 ? sheetItems.length : SET_SIZE
  const sheetTotalSec =
    sheetItems.length > 0
      ? sheetItems.reduce((s, it) => s + it.seconds, 0)
      : (unitSheet?.diagnosis?.minutes ?? 0) * 60



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
              <button
                type="button"
                aria-label="마이페이지"
                onClick={() => navigate('/my')}
                className={styles.iconCircle}
              >
                <ProfileIcon size={18} />
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

          {/* 약점 그래프 카드 (Figma 2919-8728) — 흰 카드 안 레이더.
              이 대단원에서 하나도 진단 전이면 다크 잠금 오버레이 (2842-8069) */}
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

          {/* 소단원(수학) / 유형(영어) 카드 리스트 (Figma subject-card 3종) */}
          <section className={styles.subSection}>
            <h2 className={styles.subTitle}>{unitLabel}</h2>

            <ol className={styles.unitCards}>
              {progress.rows.map((row) => {
                if (row.state === 'off') {
                  // "안배웠어요" 잠금 구간 — 시작 소단원(offHead)만 재개 진입점
                  return (
                    <li key={row.name} data-unit-card={row.name}>
                      <button
                        type="button"
                        onClick={() =>
                          row.offHead ? openStartSheet(row) : setLockedSheet(row)
                        }
                        className={clsx(styles.unitCard, styles.unitCardLocked)}
                      >
                        <span className="flex min-w-0 flex-col items-start gap-[4px] text-left">
                          <span className={styles.unitCardNameLocked}>{row.name}</span>
                          {row.offHead && (
                            <span className="text-[12px] font-medium text-[#a6abb1]">
                              안배운 단원 · 다시 풀면 열려
                            </span>
                          )}
                        </span>
                        <span className={styles.unitLockIcon} aria-label="잠김">
                          <LockIcon />
                        </span>
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
                        onClick={() => setUnitSheet(row)}
                        className={clsx(styles.unitCard, styles.unitCardDone)}
                      >
                        <span className={styles.unitCardBody}>
                          <span className={styles.unitCardNameRow}>
                            <span className={styles.unitCardName}>{row.name}</span>
                            {row.diagnosis.weak && (
                              <span className={styles.unitWeakPill}>약점</span>
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
                      <div className={clsx(styles.unitCard, styles.unitCardNext)}>
                        <span className={styles.unitCardName}>{row.name}</span>
                        <button
                          type="button"
                          onClick={() => openStartSheet(row)}
                          className={styles.unitDiagnoseBtn}
                        >
                          진단하기
                        </button>
                      </div>
                    </li>
                  )
                }
                // 잠김 — 회색 카드 + 자물쇠 → 선행 단원 안내 시트 (3082-5687)
                return (
                  <li key={row.name} data-unit-card={row.name}>
                    <button
                      type="button"
                      onClick={() => setLockedSheet(row)}
                      className={clsx(styles.unitCard, styles.unitCardLocked)}
                    >
                      <span className={styles.unitCardNameLocked}>{row.name}</span>
                      <span className={styles.unitLockIcon} aria-label="잠김">
                        <LockIcon />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>

        {/*
          웹 전용 추천 문제 진입점 — 모바일·패드는 하단 네비의 추천 FAB 가 같은 역할을 해서
          도크를 띄우지 않는다 (시안 3450-8896 적용, 2026-08-27).
          목적지는 나브 FAB 와 동일한 /today · 지금 보고 있는 과목을 그대로 넘긴다.
        */}
        <div className={styles.solveDock}>
          <button
            type="button"
            className={styles.solveDockCta}
            onClick={() => navigate(`/today?subject=${subject}`)}
          >
            {/* size 42 → 글리프 약 26px · 문제지 면이 16px 텍스트와 비슷한 높이가 된다 */}
            <RecommendIcon size={42} />
            추천 문제
          </button>
        </div>
      </main>

      {/* 약점 그래프 예시 안내 (Figma 2504-22065) — ? 버튼 시트 */}
      {infoOpen && (
        <div className={styles.infoDim} onClick={() => setInfoOpen(false)}>
          <div
            {...infoDrag.sheetProps}
            className={clsx(styles.infoSheet, infoDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setInfoOpen(false)}
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
            <button type="button" onClick={() => setInfoOpen(false)} className={styles.infoClose}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 진단 완료 유닛 상세 — 약점지도 노드 시트와 동일: 웹 우측 패널 · 모바일 바텀시트 */}
      {unitSheet?.diagnosis && (
        <div className={styles.unitDim} onClick={() => setUnitSheet(null)}>
          <div
            {...unitDrag.sheetProps}
            className={clsx(styles.unitSheet, unitDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setUnitSheet(null)}
              className={styles.infoHandleWrap}
            >
              <span className={styles.infoHandle} />
            </button>
            {/* 웹(우측 패널) 전용 닫기 버튼 — 모바일은 핸들·스와이프로 닫음 */}
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setUnitSheet(null)}
              className={styles.unitClose}
            >
              ×
            </button>

            {/* 헤더 — 유닛명 + 약점 배지 · 평균 점수 (웹은 우상단 X 버튼 아래로 내려 시작) */}
            <div className="flex w-full items-center justify-between py-[8px] xl:pt-[36px]">
              <div className="flex min-w-0 items-center gap-[8px]">
                <h2 className="truncate text-[22px] font-semibold leading-[1.4] text-[#121417]">
                  {unitSheet.name}
                </h2>
                {unitSheet.diagnosis.weak && (
                  <span className="shrink-0 rounded-full border border-[#ff385c] bg-[#fff1f2] px-[6px] py-[3px] text-[12px] font-semibold leading-[1.4] text-[#ff385c]">
                    약점
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-end gap-[8px]">
                <span className="pb-[2px] text-[16px] font-medium text-[#80858b]">평균</span>
                <span className="text-[26px] font-bold leading-none text-[#121417]">
                  {unitSheet.diagnosis.score}점
                </span>
              </div>
            </div>

            {/* 요약 스탯 — 누적 정답 수 · 총 풀이 시간 */}
            <div className="flex w-full gap-[8px]">
              <div className="flex min-w-0 flex-1 flex-col gap-[16px] rounded-[16px] bg-[#f8f8f8] p-[20px]">
                <span className="text-[12px] font-semibold text-[#80858b]">누적 정답 수</span>
                <span className="text-[22px] font-semibold text-[#121417]">
                  {unitSheet.diagnosis.correct}/{sheetTotal}개
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[16px] rounded-[16px] bg-[#f8f8f8] p-[20px]">
                <span className="text-[12px] font-semibold text-[#80858b]">총 풀이 시간</span>
                <span className="whitespace-nowrap text-[22px] font-semibold text-[#121417]">
                  {formatMinSec(sheetTotalSec)}
                </span>
              </div>
            </div>

            {/* 점수 반영 안내 */}
            <div className="flex w-full items-center justify-center gap-[4px]">
              <span className="flex size-[20px] shrink-0 items-center justify-center rounded-full bg-[#d6d8db] text-[12px] font-semibold text-[#5e6368]">
                i
              </span>
              <p className="text-[12px] font-semibold text-[#80858b]">
                {unitLabel} 점수는 추천 문제를 풀수록 새 결과가 반영돼
              </p>
            </div>

            {/* 학습 경로 — 이전 → 현재(검정) → 다음 (Figma 3361-5402) */}
            <div className="flex w-full flex-col gap-[12px]">
              <h3 className="px-[8px] text-[18px] font-bold leading-[1.4] text-[#121417]">
                학습 경로
              </h3>
              <div className="flex w-full flex-col rounded-[16px] border border-[#e5e7ea] p-[20px]">
                {buildNeighborPath(progress.rows, unitSheet.name).map((p, i, arr) => (
                  <div key={p.name} className="flex items-stretch gap-[12px]">
                    <div className="flex w-[10px] flex-col items-center">
                      {i > 0 && (
                        <span
                          className="w-px flex-1 border-l border-dashed border-[#d6d8db]"
                          aria-hidden
                        />
                      )}
                      <span
                        className={clsx(
                          'my-[2px] size-[10px] shrink-0 rounded-full',
                          p.current ? 'bg-[#121417]' : 'bg-[#d6d8db]',
                        )}
                      />
                      {i < arr.length - 1 && (
                        <span
                          className="w-px flex-1 border-l border-dashed border-[#d6d8db]"
                          aria-hidden
                        />
                      )}
                    </div>
                    <span
                      className={clsx(
                        'text-[14px] leading-none',
                        i > 0 ? 'pt-[14px]' : 'pt-[2px]',
                        p.current ? 'font-bold text-[#121417]' : 'font-medium text-[#5e6368]',
                      )}
                    >
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 섹션 구분 — 시트 좌우 패딩(20px)을 뚫는 두꺼운 띠 */}
            <div className="-mx-[20px] h-[10px] shrink-0 bg-[#f8f8f8]" aria-hidden />

            {/* 최근 학습 — 카드 탭/전체보기 → 진단 재열람 페이지 */}
            <div className="flex w-full items-center justify-between px-[8px]">
              <h3 className="text-[18px] font-bold leading-[1.4] text-[#121417]">최근 학습</h3>
              <button
                type="button"
                onClick={() =>
                  navigate(`/unit-result/${subject}/${encodeURIComponent(unitSheet.name)}`)
                }
                className="flex items-center gap-[4px] text-[12px] font-semibold text-[#80858b]"
              >
                전체보기
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M4.5 2.5 8 6l-3.5 3.5"
                    stroke="#80858b"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(`/unit-result/${subject}/${encodeURIComponent(unitSheet.name)}`)
              }
              className="w-full overflow-hidden rounded-[16px] border border-[#e5e7ea] text-left"
            >
              <span className="flex w-full items-center justify-between px-[16px] pb-[12px] pt-[16px]">
                <span className="flex items-center gap-[4px] text-[14px] leading-[1.4]">
                  <span className="font-semibold text-[#121417]">
                    {formatDiagnosisDate(unitSheet.diagnosis.date)}
                  </span>
                  {unitSheet.diagnosis.time && (
                    <span className="font-medium text-[#80858b]">{unitSheet.diagnosis.time}</span>
                  )}
                </span>
                <span className="text-[20px] font-semibold leading-[1.4] text-[#121417]">
                  {unitSheet.diagnosis.score}점
                </span>
              </span>
              {sheetItems.length > 0 ? (
                <span className="flex w-full items-center border-t border-[#e5e7ea] bg-[#f8f8f8] p-[12px]">
                  {sheetItems.map((item, i) => (
                    <span key={i} className="flex min-w-0 flex-1 items-center">
                      {i > 0 && <span className="h-[32px] w-px shrink-0 bg-[#e5e7ea]" aria-hidden />}
                      <span className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[8px]">
                        <span className="whitespace-nowrap text-[12px] font-semibold text-[#80858b]">
                          {i + 1}번({item.points}점)
                        </span>
                        <SheetMark
                          kind={item.correct ? (item.overTime ? 'triangle' : 'circle') : 'x'}
                        />
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="block border-t border-[#e5e7ea] bg-[#f8f8f8] p-[12px] text-center text-[12px] text-[#a6abb1]">
                  이 진단은 문항별 기록이 저장되기 전에 진행돼서 요약만 볼 수 있어
                </span>
              )}
            </button>

            {/* 자유 풀이 CTA (2026-08-17 정책) — 이 소단원의 맛보기 진단을
                마쳤으면 바로 풀 수 있다 (시트는 진단 완료 유닛에서만 열린다) */}
            <button
              type="button"
              onClick={() => {
                setUnitSheet(null)
                startFreeSolve(unitSheet)
              }}
              className={styles.unitButton}
            >
              추천 {SET_SIZE}문제 풀기
            </button>
          </div>
        </div>
      )}

      {/* ── 진단 시작 시트 (2842-10194) ↔ 건너뛰기 화면 (2842-10966) ─────────── */}
      {startSheet && (
        <div className={styles.unitDim} onClick={closeStartSheet}>
          <div
            {...startDrag.sheetProps}
            className={clsx(styles.unitSheet, startDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={closeStartSheet}
              className={styles.infoHandleWrap}
            >
              <span className={styles.infoHandle} />
            </button>
            <button
              type="button"
              aria-label="닫기"
              onClick={closeStartSheet}
              className={styles.unitClose}
            >
              ×
            </button>

            {!skipMode ? (
              <>
                <div className="flex w-full flex-col gap-[8px]">
                  <h2 className="text-[20px] font-semibold leading-[1.4] text-[#121417]">
                    {startSheet.name} 약점 진단하기
                  </h2>
                  <p className="text-[14px] font-medium leading-[1.4] text-[#80858b]">
                    진단을 끝내면 {startSheet.name} 그래프 결과가 채워져
                  </p>
                </div>

                {/* 문제 수 · 예상 시간 · 필요 크레딧 */}
                <div className="flex w-full items-center rounded-[16px] bg-[#f8f8f8] p-[16px]">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-[4px]">
                    <span className="text-[12px] font-semibold text-[#80858b]">문제</span>
                    <span className="text-[18px] font-bold text-[#121417]">{SET_SIZE}문제</span>
                  </div>
                  <span className="h-[26px] w-px shrink-0 bg-[#e5e7ea]" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-[4px]">
                    <span className="text-[12px] font-semibold text-[#80858b]">예상 시간</span>
                    <span className="text-[18px] font-bold text-[#121417]">
                      {estimatedSec != null
                        ? `약 ${Math.max(1, Math.round(estimatedSec / 60))}분`
                        : '약 —분'}
                    </span>
                  </div>
                  <span className="h-[26px] w-px shrink-0 bg-[#e5e7ea]" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-[4px]">
                    <span className="text-[12px] font-semibold text-[#80858b]">필요 크레딧</span>
                    <span className="text-[18px] font-bold text-[#121417]">
                      {SET_CREDIT_COST}개
                    </span>
                  </div>
                </div>

                <div className="flex w-full items-center justify-center gap-[6px]">
                  <SheetCoinIcon />
                  <span className="text-[14px] font-medium text-[#80858b]">보유 크레딧:</span>
                  <span className="text-[14px] font-semibold text-[#80858b]">{credit}개</span>
                </div>

                {(startError || credit < SET_CREDIT_COST) && (
                  <p className="w-full text-center text-[13px] font-medium text-primary">
                    {startError ?? '크레딧이 부족해'}
                  </p>
                )}

                <div className="flex w-full gap-[8px]">
                  <button
                    type="button"
                    onClick={() => setSkipMode(true)}
                    className="flex h-[55px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#f8f8f8] text-[16px] font-bold text-[#121417]"
                  >
                    이 단원 안배웠어요
                  </button>
                  <button
                    type="button"
                    onClick={confirmStartSet}
                    disabled={starting || credit < SET_CREDIT_COST}
                    className="flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {starting ? '시작 중…' : '시작하기'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex w-full flex-col gap-[8px]">
                  <h2 className="text-[20px] font-semibold leading-[1.4] text-[#121417]">
                    아직 안배운 단원이야?
                  </h2>
                  <p className="text-[14px] font-medium leading-[1.4] text-[#80858b]">
                    {startSheet.name}부터 {category.name} 끝까지 잠가둘게
                  </p>
                </div>

                <div className="flex w-full items-center justify-center gap-[6px] rounded-[12px] bg-[#f8f8f8] p-[12px]">
                  <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#d6d8db] text-[11px] font-semibold text-[#5e6368]">
                    i
                  </span>
                  <p className="text-[13px] font-medium text-[#80858b]">
                    {startSheet.name}
                    {josaEulReul(startSheet.name)} 다시 풀면 언제든 열려
                  </p>
                </div>

                {startError && (
                  <p className="w-full text-center text-[13px] font-medium text-primary">
                    {startError}
                  </p>
                )}

                <div className="flex w-full gap-[8px]">
                  <button
                    type="button"
                    onClick={() => setSkipMode(false)}
                    className="flex h-[55px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#f8f8f8] text-[16px] font-bold text-[#121417]"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={confirmSkip}
                    disabled={lockSaving}
                    className="flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {lockSaving ? '저장 중…' : '잠그기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 선행 단원 안내 시트 (3082-5687) — 잠긴 단원 클릭 ─────────────────── */}
      {lockedSheet && (
        <div className={styles.unitDim} onClick={() => setLockedSheet(null)}>
          <div
            {...lockedDrag.sheetProps}
            className={clsx(styles.unitSheet, lockedDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setLockedSheet(null)}
              className={styles.infoHandleWrap}
            >
              <span className={styles.infoHandle} />
            </button>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setLockedSheet(null)}
              className={styles.unitClose}
            >
              ×
            </button>

            <div className="flex w-full flex-col gap-[8px]">
              <h2 className="text-[20px] font-semibold leading-[1.4] text-[#121417]">
                {lockedIsOff ? '잠가둔 단원이야' : '먼저 풀어야 할 단원이 있어'}
              </h2>
              <p className="text-[14px] font-medium leading-[1.4] text-[#80858b]">
                {lockedRequired
                  ? lockedIsOff
                    ? `${lockedRequired.name}${josaEulReul(lockedRequired.name)} 다시 풀면 여기까지 열려`
                    : `${lockedRequired.name}${josaEulReul(lockedRequired.name)} 풀면 이 단원을 시작할 수 있어`
                  : '앞 단원부터 순서대로 진단할 수 있어'}
              </p>
            </div>

            {/* 학습 경로 — 직전 완료 → 먼저 풀 단원(빨강) → 클릭한 단원 */}
            <div className="flex w-full flex-col rounded-[16px] border border-[#e5e7ea] p-[20px]">
              {buildLockedPath(progress.rows, lockedRequired, lockedSheet).map((p, i) => (
                <div key={p.name} className="flex items-stretch gap-[12px]">
                  <div className="flex w-[10px] flex-col items-center">
                    {i > 0 && (
                      <span
                        className="w-px flex-1 border-l border-dashed border-[#d6d8db]"
                        aria-hidden
                      />
                    )}
                    <span
                      className={clsx(
                        'my-[2px] size-[10px] shrink-0 rounded-full',
                        p.current ? 'bg-primary' : 'bg-[#d6d8db]',
                      )}
                    />
                    {i < 2 && (
                      <span
                        className="w-px flex-1 border-l border-dashed border-[#d6d8db]"
                        aria-hidden
                      />
                    )}
                  </div>
                  <span
                    className={clsx(
                      'text-[14px] leading-none',
                      i > 0 ? 'pt-[14px]' : 'pt-[2px]',
                      p.current ? 'font-bold text-[#121417]' : 'font-medium text-[#5e6368]',
                    )}
                  >
                    {p.name}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const next = lockedRequired
                setLockedSheet(null)
                openStartSheet(next)
              }}
              className="flex h-[56px] w-full items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90"
            >
              {lockedRequired
                ? `${lockedRequired.name} ${lockedIsOff ? '다시 풀기' : '먼저 풀기'}`
                : '확인'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* --- 진단 시작·건너뛰기·선행 안내 시트 헬퍼 (2842-10194 · 2842-10966 · 3082-5687) --- */

/** 을/를 조사 — 받침 유무로 판정 */
function josaEulReul(word: string): string {
  const last = word.charCodeAt(word.length - 1)
  if (last < 0xac00 || last > 0xd7a3) return '을(를)'
  return (last - 0xac00) % 28 === 0 ? '를' : '을'
}

/** 선행 안내 경로 3줄 — [직전 완료 단원?] → [다음 풀 단원(빨강)] → [클릭한 잠긴 단원] */
function buildLockedPath(
  rows: UnitProgressRow[],
  nextUnit: UnitProgressRow | undefined,
  clicked: UnitProgressRow,
): { name: string; current: boolean }[] {
  const path: { name: string; current: boolean }[] = []
  if (nextUnit) {
    const nextIdx = rows.findIndex((r) => r.name === nextUnit.name)
    const prevDone = rows.slice(0, nextIdx).filter((r) => r.state === 'done').at(-1)
    if (prevDone) path.push({ name: prevDone.name, current: false })
    path.push({ name: nextUnit.name, current: true })
  }
  if (!path.some((p) => p.name === clicked.name)) path.push({ name: clicked.name, current: false })
  return path.slice(0, 3)
}

/** 보유 크레딧 코인 (20px) — CreditBadge 코인과 동일 그래픽 */
function SheetCoinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
      <circle cx="10" cy="10" r="9.2" fill="#F8D558" />
      <circle cx="10" cy="10" r="6.9" stroke="#EC9C40" strokeWidth="1.6" />
      <path
        d="M12.9 7.9a3.4 3.4 0 100 4.2"
        stroke="#E08E39"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* --- 유닛 시트 헬퍼 (Figma 2857-22101) --- */

/** "YYYY-MM-DD" → "오늘"/"어제"/"8월 23일" (최근 학습 카드 진단일 · Figma 3361-5402) */
function formatDiagnosisDate(date: string): string {
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  const target = new Date(Number(y), Number(m) - 1, Number(d))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  return `${Number(m)}월 ${Number(d)}일`
}

/**
 * 상세 시트 학습 경로 — 현재 유닛을 가운데 둔 3개 창.
 * 첫/마지막 유닛이라 이웃이 모자라면 창을 밀어 항상 3개를 보여준다 (3361-5402).
 */
function buildNeighborPath(
  rows: UnitProgressRow[],
  currentName: string,
): { name: string; current: boolean }[] {
  const idx = rows.findIndex((r) => r.name === currentName)
  if (idx < 0) return [{ name: currentName, current: true }]
  const start = Math.max(0, Math.min(idx - 1, rows.length - 3))
  return rows
    .slice(start, start + 3)
    .map((r) => ({ name: r.name, current: r.name === currentName }))
}

/** 총 풀이 시간 — "12분 48초" (60초 미만은 "48초") */
function formatMinSec(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60)
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

/** 최근 학습 카드의 문항 마크 — O(정답) · △(정답이지만 시간 초과) · X(오답), 시안 16px */
function SheetMark({ kind }: { kind: 'circle' | 'triangle' | 'x' }) {
  const label = kind === 'circle' ? '정답' : kind === 'triangle' ? '정답 (시간 초과)' : '오답'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label={label}>
      {kind === 'circle' && <circle cx="8" cy="8" r="6" stroke="#ff385c" strokeWidth="2" />}
      {kind === 'triangle' && (
        <path d="M8 3 14 13H2z" stroke="#ff385c" strokeWidth="2" strokeLinejoin="round" />
      )}
      {kind === 'x' && (
        <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" stroke="#ff385c" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  )
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

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="6.5" rx="1.6" fill="currentColor" />
      <path
        d="M5.2 7V5.4a2.8 2.8 0 0 1 5.6 0V7"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  )
}



