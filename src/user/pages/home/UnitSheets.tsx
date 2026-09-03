import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { CreditShortagePopup } from '@/user/components/CreditShortagePopup'
import { ConfirmDialog } from '@/user/components/ConfirmDialog'
import { Toast } from '@/user/components/Toast'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { type Subject } from '@/user/stores/trialStore'
import { useUserStore } from '@/user/stores/userStore'
import { useSolveStore } from '@/user/stores/solveStore'
import { declareUnitLock } from '@/user/api/recommendApi'
import { fetchActiveProblemSet, type IssuedProblemSet } from '@/user/api/problemSetApi'
import { loadIssuedSet, loadQuizProblems } from '@/user/services/problemSet'
import { startTrialSetSession } from '@/user/services/trialSetStart'
import { snapshotUnitScoreForSet } from '@/user/services/unitScoreSnapshot'
import { setCreditUsedFlash } from '@/user/components/CreditUsedToast'
import {
  SET_CREDIT_COST,
  type UnitProgressRow,
} from '@/user/stores/trialProgressStore'
import { UNIT_LABEL, type CurriculumCategory } from '@/user/data/curriculum'
import styles from './styles/HomePage.module.scss'

/** 이어풀기 변형 시트 요약 — 남은 문항 수 · 남은 예상 시간(권장 시간 합) */
function remainingOfSet(set: IssuedProblemSet) {
  const left = set.items.filter((item) => !item.submitted)
  return { count: left.length, sec: left.reduce((s, item) => s + item.recommendedTimeSec, 0) }
}

/** 맛보기 세트 문항 수 — 정책 3문항 */
const SET_SIZE = 3

/**
 * 진단 완료 토스트 플래시 (3575-7884 · 토스트 팝업 정책) — 결과 페이지의 "진단 완료"가
 * 기록하고, 복귀한 홈·지도가 1회 소비한다 (읽는 즉시 삭제 = 첫 1회 보장).
 */
const DIAGNOSE_DONE_FLASH_KEY = 'pullit_diagnose_done_flash'

export function setDiagnoseDoneFlash(unitName: string, subject: Subject): void {
  try {
    sessionStorage.setItem(DIAGNOSE_DONE_FLASH_KEY, JSON.stringify({ unitName, subject }))
  } catch {
    /* storage 불가 환경 — 토스트 생략 */
  }
}

function consumeDiagnoseDoneFlash(subject: Subject): string | null {
  try {
    const raw = sessionStorage.getItem(DIAGNOSE_DONE_FLASH_KEY)
    if (!raw) return null
    sessionStorage.removeItem(DIAGNOSE_DONE_FLASH_KEY)
    const parsed = JSON.parse(raw) as { unitName?: string; subject?: string }
    if (typeof parsed.unitName !== 'string' || parsed.subject !== subject) return null
    return parsed.unitName
  } catch {
    return null
  }
}

/**
 * 단원 상세 재오픈 플래시 — 세트 완료 점수 변동 화면(/solve-result)에서 "완료"로 약점 지도로
 * 돌아올 때, 방금 푼 소단원을 선택 상태로 상세 시트까지 열어 둔다 (Figma 3699-11683 · 2026-09-02).
 * 약점 지도에서 시작한 자유 풀이(진단 이후)만 해당 — 홈에서 시작한 세트는 홈으로 돌아가며 안 쓴다.
 */
const UNIT_REOPEN_FLASH_KEY = 'pullit_unit_reopen_flash'

export function setUnitReopenFlash(unitName: string, subject: Subject): void {
  try {
    sessionStorage.setItem(UNIT_REOPEN_FLASH_KEY, JSON.stringify({ unitName, subject }))
  } catch {
    /* storage 불가 환경 — 재오픈 생략 */
  }
}

export function consumeUnitReopenFlash(subject: Subject): string | null {
  try {
    const raw = sessionStorage.getItem(UNIT_REOPEN_FLASH_KEY)
    if (!raw) return null
    sessionStorage.removeItem(UNIT_REOPEN_FLASH_KEY)
    const parsed = JSON.parse(raw) as { unitName?: string; subject?: string }
    if (typeof parsed.unitName !== 'string' || parsed.subject !== subject) return null
    return parsed.unitName
  } catch {
    return null
  }
}

/**
 * 소단원 액션 시트 묶음 — 홈과 약점 지도가 같은 로직·같은 화면을 쓴다 (2026-08-31).
 *
 * 상태별 분기 (openUnit):
 * - done            → 단원 상세 시트 (요약·학습 경로·최근 학습·추천 문제 풀기)
 * - next            → 진단 시작 시트 (진단하기 + "안배웠어요")
 * - off + offHead   → 재진단 시트 (건너뛴 단원 다시 진단하기 · 3575-7722)
 * - off·locked      → 선행 안내 시트 (3082-5687)
 *
 * 시트를 연 시점의 카테고리·행 목록(ctx)을 함께 저장한다 — 지도는 여러
 * 대분류의 노드가 한 화면에 있어 페이지 수준 카테고리가 없다.
 */
export interface UnitSheetContext {
  category: CurriculumCategory
  rows: UnitProgressRow[]
}

export function useUnitSheets({
  subject,
  credit,
  returnTo,
  onLocksChanged,
  onAllClosed,
  resolveUnit,
}: {
  subject: Subject
  credit: number
  /** 세트 종료 후 복귀 경로 — 열 때마다 평가 (홈은 쿼리 유지가 필요) */
  returnTo: () => string
  /** "안배웠어요" 확정 후 — 페이지가 잠금 상태를 다시 불러오게 */
  onLocksChanged: () => void
  /** 모든 시트가 닫혔을 때 — 지도가 노드 선택을 해제하는 데 쓴다 */
  onAllClosed?: () => void
  /** 진단 완료 토스트의 "보기" — 단원명으로 행·컨텍스트를 찾아 상세 시트를 연다 (3575-7884) */
  resolveUnit?: (unitName: string) => { row: UnitProgressRow; context: UnitSheetContext } | null
}) {
  const navigate = useNavigate()
  const loadMe = useUserStore((s) => s.loadMe)
  const startSolveSession = useSolveStore((s) => s.startSession)

  const unitLabel = UNIT_LABEL[subject]

  const [ctx, setCtx] = useState<UnitSheetContext | null>(null)
  const [unitSheet, setUnitSheet] = useState<UnitProgressRow | null>(null)
  /**
   * 상세 시트 모드 — 'detail'(단원 상세) ↔ 'confirm'(추천 확인 · 3715-6852).
   * 별도 시트를 띄우지 않고 같은 시트가 제자리에서 줄어들며 내용만 바뀐다 (모프 전환)
   */
  const [unitSheetMode, setUnitSheetMode] = useState<'detail' | 'confirm'>('detail')
  const [startSheet, setStartSheet] = useState<UnitProgressRow | null>(null)
  const [skipMode, setSkipMode] = useState(false)
  const [lockedSheet, setLockedSheet] = useState<UnitProgressRow | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [lockSaving, setLockSaving] = useState(false)
  const [shortageOpen, setShortageOpen] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null) // 시트 밖 실패 안내 팝업 (브라우저 alert 대체)
  // 시트가 하나라도 열려 있으면 배경(body) 스크롤 잠금 — 시트 스크롤이 페이지로 새지 않게
  const anySheetOpen = !!(unitSheet || startSheet || lockedSheet)
  useEffect(() => {
    if (!anySheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [anySheetOpen])

  // 열림 → 닫힘 전이에서만 통지 — 지도가 노드 선택 해제에 쓴다
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (wasOpenRef.current && !anySheetOpen) onAllClosed?.()
    wasOpenRef.current = anySheetOpen
  }, [anySheetOpen, onAllClosed])

  // 상세 시트 폴드 — 처음 열면 학습 경로까지만 보이고 최근 학습은 스크롤 뒤에 (2026-09-01).
  // 콘텐츠 높이가 기기·단원마다 달라 CSS 고정값 대신 구분 띠 위치를 실측해 몸통 높이를 자른다
  const sheetScrollRef = useRef<HTMLDivElement | null>(null)
  const foldRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const body = sheetScrollRef.current
    const fold = foldRef.current
    if (!unitSheet || !body || !fold) return
    // 웹 우측 패널은 높이가 고정(%)이라 자르면 아래가 비어 보인다 — 모바일·패드만
    if (window.matchMedia('(min-width: 1281px)').matches) {
      body.style.maxHeight = ''
      return
    }
    body.style.maxHeight = `${fold.offsetTop - body.offsetTop}px`
  }, [unitSheet])

  // 건너뛰기 확정 토스트 (3715-9240) — 시트가 닫힌 뒤 "{소단원명}부터 건너뛰었어"
  const [skipToast, setSkipToast] = useState<string | null>(null)
  useEffect(() => {
    if (!skipToast) return
    const timer = window.setTimeout(() => setSkipToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [skipToast])

  // 진단 완료 토스트 (3575-7884) — 결과 페이지에서 돌아온 첫 1회, 2초 노출 (시안 주석 정책)
  const [doneToast, setDoneToast] = useState<string | null>(null)
  useEffect(() => {
    const consumed = consumeDiagnoseDoneFlash(subject)
    if (consumed) setDoneToast(consumed)
    // 마운트 시 1회 — 플래시는 읽는 즉시 지워져 과목 전환 재실행에도 안전
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!doneToast) return
    const timer = window.setTimeout(() => setDoneToast(null), 2000)
    return () => window.clearTimeout(timer)
  }, [doneToast])

  const isDesktop = () => window.matchMedia('(min-width: 1281px)').matches
  const closeStartSheet = () => {
    setStartSheet(null)
    setSkipMode(false)
    setStartError(null)
  }
  const unitDrag = useSheetDrag(() => setUnitSheet(null), { disabled: isDesktop })
  const startDrag = useSheetDrag(closeStartSheet, { disabled: isDesktop })
  const lockedDrag = useSheetDrag(() => setLockedSheet(null), { disabled: isDesktop })

  /**
   * 열려 있는 시트 엘리먼트 — 지도가 "시트가 가리는 높이"를 실측해 카메라를
   * 시트 위 영역으로 피하는 데 쓴다. 시트는 동시에 하나만 열리므로 ref 하나를 공유.
   */
  const sheetEl = useRef<HTMLDivElement | null>(null)
  const bindSheetEl =
    (dragRef: React.MutableRefObject<HTMLDivElement | null>) => (el: HTMLDivElement | null) => {
      if (el) sheetEl.current = el
      dragRef.current = el
    }
  const { ref: unitDragRef, ...unitDragHandlers } = unitDrag.sheetProps
  const { ref: startDragRef, ...startDragHandlers } = startDrag.sheetProps
  const { ref: lockedDragRef, ...lockedDragHandlers } = lockedDrag.sheetProps

  const openStartSheet = (row: UnitProgressRow | undefined) => {
    if (!row) return
    setSkipMode(false)
    setStartError(null)
    setStartSheet(row)
  }

  /** 상태별 분기 진입점 — 카드·노드 클릭이 전부 여기로 온다 */
  const openUnit = (row: UnitProgressRow, context: UnitSheetContext) => {
    setCtx(context)
    if (row.diagnosis) {
      setUnitSheetMode('detail')
      setUnitSheet(row)
    }
    if (row.diagnosis) return
    if (row.state === 'off') {
      // 건너뛴 구간은 어느 칸을 눌러도 재개 진입점(잠금 시작 소단원)의 재진단 시트 (3693-9855)
      openStartSheet(context.rows.find((r) => r.offHead) ?? row)
      return
    }
    if (row.state === 'next') openStartSheet(row)
    else setLockedSheet(row)
  }

  /** 진단 완료 토스트 "보기" — 방금 진단한 단원의 상세 시트로 (2856-20608) */
  const viewDoneToastUnit = () => {
    if (!doneToast) return
    const hit = resolveUnit?.(doneToast)
    setDoneToast(null)
    if (hit) openUnit(hit.row, hit.context)
  }

  // 진행 중(ACTIVE) 진단 세트 감지 — 시트가 이어풀기 변형(남은 문제·크레딧 없음)으로 바뀐다
  const [activeTrialSet, setActiveTrialSet] = useState<IssuedProblemSet | null>(null)
  const resumable = !!activeTrialSet
  useEffect(() => {
    setActiveTrialSet(null)
    if (!startSheet) return
    let alive = true
    fetchActiveProblemSet(subject, startSheet.unitCode, 'TRIAL')
      .then((active) => {
        if (alive) setActiveTrialSet(active)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [startSheet, subject])

  // 예상 시간 — 세트 문항의 권장 시간 합 (문제 세트 캐시 공유라 보통 즉시).
  // 진단 시작 시트·추천 확인 모드가 같은 계산을 쓴다
  const confirmTarget = unitSheetMode === 'confirm' ? unitSheet : null
  const estimateTarget = startSheet ?? confirmTarget
  const [estimatedSec, setEstimatedSec] = useState<number | null>(null)
  useEffect(() => {
    setEstimatedSec(null)
    if (!estimateTarget) return
    let alive = true
    loadQuizProblems(
      subject,
      estimateTarget.nodeId ?? (subject === 'math' ? 'sn-exp-log-01' : 'en-blank'),
    ).then((problems) => {
      if (alive && problems.length > 0)
        setEstimatedSec(problems.reduce((s, p) => s + p.tRecSec, 0))
    })
    return () => {
      alive = false
    }
  }, [estimateTarget, subject])

  // 진행 중(ACTIVE) 추천(FREE) 세트 감지 — 확인 시트가 이어풀기 변형으로 바뀐다
  const [activeFreeSet, setActiveFreeSet] = useState<IssuedProblemSet | null>(null)
  const freeResumable = !!activeFreeSet
  useEffect(() => {
    setActiveFreeSet(null)
    if (!confirmTarget) return
    let alive = true
    fetchActiveProblemSet(subject, confirmTarget.unitCode, 'FREE')
      .then((active) => {
        if (alive) setActiveFreeSet(active)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmTarget?.unitCode, subject])

  /** 추천 확인 시트 CTA — 크레딧 확인 후 FREE 세트 시작 (이어풀기는 재차감 없음) */
  const [freeStarting, setFreeStarting] = useState(false)
  const confirmStartFree = async () => {
    if (!confirmTarget || freeStarting) return
    if (!freeResumable && credit < SET_CREDIT_COST) {
      setShortageOpen(true)
      return
    }
    setFreeStarting(true)
    try {
      await startFreeSolve(confirmTarget)
    } finally {
      setFreeStarting(false)
    }
  }

  /**
   * 상세 → 확인 모프 전환 (FLIP) — 시트를 닫았다 새로 띄우지 않고, 현재 높이에서
   * 새 내용의 높이로 부드럽게 줄어들며 내용이 바뀐다. 웹 우측 패널은 높이가
   * 고정이라 내용 교체(페이드)만 한다.
   */
  const morphFromHeight = useRef<number | null>(null)
  const openConfirmMode = () => {
    const el = sheetEl.current
    if (el && !isDesktop()) morphFromHeight.current = el.offsetHeight
    setUnitSheetMode('confirm')
  }
  useLayoutEffect(() => {
    if (unitSheetMode !== 'confirm') return
    const el = sheetEl.current
    const from = morphFromHeight.current
    morphFromHeight.current = null
    if (!el || from == null) return
    const to = el.offsetHeight // 새 내용의 자연 높이
    if (Math.abs(to - from) < 2) return
    el.style.height = `${from}px`
    el.style.overflow = 'hidden'
    // 강제 리플로우 — 시작 높이를 확정해야 같은 프레임의 목표 높이가 전환으로 굴러간다
    // (rAF 는 페인트 전에 실행돼 두 값이 합쳐져 스냅된다)
    void el.offsetHeight
    el.style.transition = 'height 320ms cubic-bezier(0.22, 0.9, 0.3, 1)'
    el.style.height = `${to}px`
    const done = () => {
      el.style.transition = ''
      el.style.height = ''
      el.style.overflow = ''
      el.removeEventListener('transitionend', done)
    }
    el.addEventListener('transitionend', done)
  }, [unitSheetMode])

  /**
   * 진단 세트 시작·재개 코어 — 시작 시트와 이어풀기 팝업(PI-POPUP-RESUME)이 공유한다.
   * 팝업은 현재 탭과 다른 과목의 세트도 재개할 수 있어 과목(subj)을 인자로 받는다.
   */
  const startTrialSet = async (
    row: { name: string; unitCode: string; nodeId?: string },
    subj: Subject,
  ) => {
    // 세트 발급·스토어 세팅은 추천 리빌 CTA 와 공용 (services/trialSetStart)
    const path = await startTrialSetSession(subj, row, returnTo(), credit)
    navigate(path)
  }

  /**
   * 시작하기 — 세트 발급 (2026-08-30). 크레딧 차감·문항 구성·박제가 서버 한 트랜잭션이고,
   * 진행 중(ACTIVE) 세트가 있으면 그대로 돌아와(재차감 없음) 첫 미제출 문항부터 재개된다.
   */
  const confirmStartSet = async () => {
    if (!startSheet || starting) return
    // 새 발급(이어풀기 아님)인데 크레딧이 모자라면 — 진행 대신 부족 팝업
    if (!resumable && credit < SET_CREDIT_COST) {
      setShortageOpen(true)
      return
    }
    setStarting(true)
    setStartError(null)
    try {
      await startTrialSet(startSheet, subject)
    } catch (error) {
      setStartError(extractApiMessage(error) ?? '세트 시작에 실패했어. 잔액을 확인하고 다시 시도해줘')
      setStarting(false)
    }
  }

  /**
   * "안배웠어요" 확정 (2026-08-26 정책) — 이 소단원부터 대단원 끝까지 서버에 잠금 선언.
   * 해제는 잠금 시작 소단원을 다시 풀어 박제될 때 서버가 자동 처리.
   */
  const confirmSkip = async () => {
    if (!startSheet || lockSaving) return
    setLockSaving(true)
    try {
      await declareUnitLock(subject, startSheet.unitCode)
      onLocksChanged()
      setSkipToast(startSheet.name)
      closeStartSheet()
    } catch {
      setStartError('잠금 저장에 실패했어. 다시 시도해줘')
    } finally {
      setLockSaving(false)
    }
  }

  /**
   * 자유 풀이 (2026-08-17 정책) — 소단원의 맛보기 진단을 마쳤으면 FREE 세션으로 진입.
   */
  const startFreeSolve = async (
    row: { name?: string; unitCode: string; nodeId?: string },
    subj: Subject = subject,
  ) => {
    try {
      const nodeId = row.nodeId ?? (subj === 'math' ? 'sn-exp-log-01' : 'en-blank')
      const { set, problems, firstUnsolvedIdx } = await loadIssuedSet(
        subj, nodeId, row.unitCode, 'FREE')
      if (!set.resumed) setCreditUsedFlash(SET_CREDIT_COST, credit - SET_CREDIT_COST)
      loadMe(true)
      // 세트 완료 후 "이전 평균 → 현재 평균" 비교용 — 시작 시점 누적 점수를 찍어 둔다
      const scoreBefore = row.name
        ? await snapshotUnitScoreForSet(subj, row.name, set.setId, set.resumed)
        : null
      startSolveSession({
        problems,
        source: 'FREE',
        returnTo: returnTo(),
        setId: set.setId,
        unitName: row.name,
        scoreBefore,
      })
      navigate(`/solve/${subj}/${firstUnsolvedIdx}`)
    } catch (error) {
      setAlertMsg(extractApiMessage(error) ?? '세트 시작에 실패했어. 잔액을 확인해줘')
    }
  }

  /**
   * 잠긴 카드 안내 시트의 "먼저 풀어야 할" 유닛 —
   * off 구간(안배웠어요)은 잠금 시작 소단원(offHead), 순서 잠금은 다음 진단 유닛.
   */
  const rows = ctx?.rows ?? []
  const lockedIsOff = lockedSheet?.state === 'off'
  const lockedRequired = lockedIsOff
    ? rows.find((r) => r.offHead)
    : rows.find((r) => r.state === 'next')

  /** 유닛 시트 요약값 — 문항별 기록이 있으면 초 단위 합산, 없으면(구버전) 분 근사 */
  const sheetItems = unitSheet?.diagnosis?.items ?? []
  const sheetTotal = sheetItems.length > 0 ? sheetItems.length : SET_SIZE
  const sheetTotalSec =
    sheetItems.length > 0
      ? sheetItems.reduce((s, it) => s + it.seconds, 0)
      : (unitSheet?.diagnosis?.minutes ?? 0) * 60

  const element = (
    <>
      {/* 진단 완료 유닛 상세 (2857-22101) — 웹 우측 패널 · 모바일 바텀시트 */}
      {unitSheet?.diagnosis && (
        <div className={styles.unitDim} onClick={unitDrag.close}>
          <div
            {...unitDragHandlers}
            ref={bindSheetEl(unitDragRef)}
            className={clsx(
              styles.unitSheet,
              unitSheetMode === 'detail' && styles.unitSheetSplit,
              unitDrag.dragging && styles.infoSheetDragging,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={unitDrag.close}
              className={styles.infoHandleWrap}
            >
              <span className={styles.infoHandle} />
            </button>
            {/* 웹(우측 패널) 전용 닫기 버튼 — 모바일은 핸들·스와이프로 닫음 */}
            <button
              type="button"
              aria-label="닫기"
              onClick={unitDrag.close}
              className={styles.unitClose}
            >
              ×
            </button>

            {unitSheetMode === 'detail' && (
            <>
            {/* 몸통 — 학습 경로까지 보이고 최근 학습은 스크롤로 (CTA 는 아래 고정) */}
            <div ref={sheetScrollRef} className={styles.unitSheetScroll}>

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
              <LearningPath items={buildNeighborPath(rows, unitSheet.name)} />
            </div>

            {/* 섹션 구분 — 시트 좌우 패딩(20px)을 뚫는 두꺼운 띠. 폴드 기준점(여기까지 보임) */}
            <div ref={foldRef} className="-mx-[20px] h-[10px] shrink-0 bg-[#f8f8f8]" aria-hidden />

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

            </div>

            {/* 자유 풀이 CTA — 시트 하단 고정 (스크롤과 무관하게 항상 보인다) */}
            <div className={styles.unitSheetFoot}>
              <button
                type="button"
                onClick={openConfirmMode} // 같은 시트가 줄어들며 확인 내용(3715-6852)으로 바뀐다
                className={styles.unitButton}
              >
                추천 문제 보기
              </button>
            </div>
            </>
            )}

            {/* ── 추천 확인 (3715-6852) — 같은 시트 안에서 내용만 교체 ── */}
            {unitSheetMode === 'confirm' && (
              <div className="flex w-full animate-[sheet-morph-in_260ms_ease_60ms_both] flex-col gap-[24px]">
                <style>{`@keyframes sheet-morph-in { from { opacity: 0 } }`}</style>
                <div className="flex w-full flex-col gap-[8px] xl:pt-[36px]">
                  <h2 className="text-[20px] font-semibold leading-[1.4] text-[#121417]">
                    {activeFreeSet
                      ? `${unitSheet.name} 이어풀기`
                      : `${unitSheet.name} 추천 ${SET_SIZE}문제`}
                  </h2>
                  <p className="text-[14px] font-medium leading-[1.4] text-[#80858b]">
                    {activeFreeSet
                      ? '풀다 만 문제가 있어. 크레딧 차감 없이 이어서 풀 수 있어'
                      : '최근 풀이 기록으로 너에게 딱 맞는 문제로 준비했어'}
                  </p>
                </div>

                {/* 문제 · 예상 시간 · 필요 크레딧 — 진단 시작 시트와 같은 규격.
                    이어풀기 변형은 남은 문항 기준 + 크레딧 없음 (시안 이어풀기 상태) */}
                <div className="flex w-full items-center rounded-[16px] bg-[#f8f8f8] p-[16px]">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-[4px]">
                    <span className="text-[12px] font-semibold leading-[1.4] text-[#80858b]">
                      {activeFreeSet ? '남은 문제' : '문제'}
                    </span>
                    <span className="text-[18px] font-bold leading-[1.4] text-[#121417]">
                      {activeFreeSet ? remainingOfSet(activeFreeSet).count : SET_SIZE}문제
                    </span>
                  </div>
                  <span className="h-[26px] w-px shrink-0 bg-[#e5e7ea]" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-[4px]">
                    <span className="text-[12px] font-semibold leading-[1.4] text-[#80858b]">예상 시간</span>
                    <span className="whitespace-nowrap text-[18px] font-bold leading-[1.4] text-[#121417]">
                      {activeFreeSet
                        ? `약 ${Math.max(1, Math.round(remainingOfSet(activeFreeSet).sec / 60))}분`
                        : estimatedSec != null
                          ? `약 ${Math.max(1, Math.round(estimatedSec / 60))}분`
                          : '약 —분'}
                    </span>
                  </div>
                  <span className="h-[26px] w-px shrink-0 bg-[#e5e7ea]" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-[4px]">
                    <span className="text-[12px] font-semibold leading-[1.4] text-[#80858b]">필요 크레딧</span>
                    <span className="text-[18px] font-bold leading-[1.4] text-[#121417]">
                      {activeFreeSet ? '없음' : `${SET_CREDIT_COST}개`}
                    </span>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-[8px] pb-[8px]">
                  <div className="flex w-full items-center justify-center gap-[8px]">
                    <SheetCoinIcon />
                    <span className="text-[14px] font-medium leading-[1.4] text-[#80858b]">보유 크레딧:</span>
                    <span className="text-[14px] font-semibold leading-[1.4] text-[#80858b]">{credit}개</span>
                  </div>
                  <button
                    type="button"
                    onClick={confirmStartFree}
                    disabled={freeStarting}
                    className="flex h-[56px] w-full items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {freeStarting
                      ? '시작 중…'
                      : freeResumable
                        ? '이어풀기'
                        : `추천 ${SET_SIZE}문제 풀기`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 진단 시작 시트 (2842-10194) ↔ 건너뛰기 화면 (2842-10966) ─────────── */}
      {startSheet && (
        <div className={styles.unitDim} onClick={startDrag.close}>
          <div
            {...startDragHandlers}
            ref={bindSheetEl(startDragRef)}
            className={clsx(styles.unitSheet, startDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={startDrag.close}
              className={styles.infoHandleWrap}
            >
              <span className={styles.infoHandle} />
            </button>
            <button
              type="button"
              aria-label="닫기"
              onClick={startDrag.close}
              className={styles.unitClose}
            >
              ×
            </button>

            {!skipMode ? (
              <>
                <div className="flex w-full flex-col gap-[8px] xl:pt-[36px]">
                  {/* 건너뛴(off) 구간 재진단 변형 (3693-9855) — 시작 소단원 기준 문구.
                      진행 중(ACTIVE) 세트가 있으면 이어풀기 변형이 우선 */}
                  <h2 className="text-[20px] font-semibold leading-[1.4] text-[#121417]">
                    {activeTrialSet
                      ? `${startSheet.name} 이어풀기`
                      : startSheet.state === 'off'
                        ? `${startSheet.name}부터 다시 진단하기`
                        : `${startSheet.name} 약점 진단하기`}
                  </h2>
                  <p className="text-[14px] font-medium leading-[1.4] text-[#80858b]">
                    {activeTrialSet
                      ? '풀다 만 문제가 있어. 크레딧 차감 없이 이어서 풀 수 있어'
                      : startSheet.state === 'off'
                        ? `${startSheet.name}부터 다시 진단하면 건너뛴 단원이 모두 열려`
                        : `진단을 끝내면 ${startSheet.name} 그래프 결과가 채워져`}
                  </p>
                </div>

                {/* 문제 수 · 예상 시간 · 필요 크레딧 (3715-8753 — 라벨 12 · 값 18 bold).
                    이어풀기 변형은 남은 문항 기준 + 크레딧 없음 */}
                <div className="flex w-full items-center rounded-[16px] bg-[#f8f8f8] p-[16px]">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-[4px]">
                    <span className="text-[12px] font-semibold leading-[1.4] text-[#80858b]">
                      {activeTrialSet ? '남은 문제' : '문제'}
                    </span>
                    <span className="text-[18px] font-bold leading-[1.4] text-[#121417]">
                      {activeTrialSet ? remainingOfSet(activeTrialSet).count : SET_SIZE}문제
                    </span>
                  </div>
                  <span className="h-[26px] w-px shrink-0 bg-[#e5e7ea]" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-[4px]">
                    <span className="text-[12px] font-semibold leading-[1.4] text-[#80858b]">예상 시간</span>
                    <span className="whitespace-nowrap text-[18px] font-bold leading-[1.4] text-[#121417]">
                      {activeTrialSet
                        ? `약 ${Math.max(1, Math.round(remainingOfSet(activeTrialSet).sec / 60))}분`
                        : estimatedSec != null
                          ? `약 ${Math.max(1, Math.round(estimatedSec / 60))}분`
                          : '약 —분'}
                    </span>
                  </div>
                  <span className="h-[26px] w-px shrink-0 bg-[#e5e7ea]" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-[4px]">
                    <span className="text-[12px] font-semibold leading-[1.4] text-[#80858b]">필요 크레딧</span>
                    <span className="text-[18px] font-bold leading-[1.4] text-[#121417]">
                      {activeTrialSet ? '없음' : `${SET_CREDIT_COST}개`}
                    </span>
                  </div>
                </div>

                {/* 보유 크레딧 (3715-8766) — 14px · 라벨 medium / 값 semibold, 둘 다 black/500 */}
                <div className="flex w-full items-center justify-center gap-[8px]">
                  <SheetCoinIcon />
                  <span className="text-[14px] font-medium leading-[1.4] text-[#80858b]">보유 크레딧:</span>
                  <span className="text-[14px] font-semibold leading-[1.4] text-[#80858b]">{credit}개</span>
                </div>

                {startError && (
                  <p className="w-full text-center text-[13px] font-medium text-primary">
                    {startError}
                  </p>
                )}
                {/* 전체폭 시작 버튼 → 그 아래 "안배웠어요" 텍스트 링크 (Figma PI-SHEET-START) */}
                <div className="flex w-full flex-col gap-[12px]">
                  <button
                    type="button"
                    onClick={confirmStartSet}
                    disabled={starting}
                    className="flex h-[56px] w-full items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {/* CTA 정책: 미진단·건너뛴 재개 = "{소단원명} 진단하기" (3715-7668) —
                        "추천 문제 풀기"는 이미 진단한 단원(상세 시트)의 몫 */}
                    {starting
                      ? '시작 중…'
                      : resumable
                        ? '이어풀기'
                        : `${startSheet.name} 진단하기`}
                  </button>
                  {/* "안배웠어요"는 미진단(next) 단원에서만 (2026-08-31 정책).
                      이어풀기 중엔 이미 크레딧 내고 시작한 단원이라 모순, 건너뛴 구간
                      재진단(off)은 또 건너뛰는 순환이라 뺀다 (3575-7722) */}
                  {!resumable && startSheet.state === 'next' && (
                    <button
                      type="button"
                      onClick={() => setSkipMode(true)}
                      className="w-full text-center text-[16px] font-semibold leading-[1.4] text-[#80858b] transition-colors hover:text-[#121417]"
                    >
                      이 단원 아직 안배웠어요
                    </button>
                  )}
                </div>
              </>
            ) : (
              (() => {
                // 건너뛸 범위 — 이 단원부터 대단원 끝까지
                const units = ctx?.category.units ?? []
                const fromIdx = units.findIndex((u) => u.unitCode === startSheet.unitCode)
                const skipped = fromIdx >= 0 ? units.slice(fromIdx) : [startSheet]
                return (
                  <SkipConfirmContent
                    unitName={startSheet.name}
                    unitLabel={unitLabel}
                    skipUnits={skipped}
                    error={startError}
                    saving={lockSaving}
                    onCancel={() => setSkipMode(false)}
                    onConfirm={confirmSkip}
                    desktopTopGap
                  />
                )
              })()
            )}
          </div>
        </div>
      )}

      {/* ── 선행 단원 안내 시트 (3082-5687) — 잠긴 단원 클릭 ─────────────────── */}
      {lockedSheet && (
        <div className={styles.unitDim} onClick={lockedDrag.close}>
          <div
            {...lockedDragHandlers}
            ref={bindSheetEl(lockedDragRef)}
            className={clsx(styles.unitSheet, lockedDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={lockedDrag.close}
              className={styles.infoHandleWrap}
            >
              <span className={styles.infoHandle} />
            </button>
            <button
              type="button"
              aria-label="닫기"
              onClick={lockedDrag.close}
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
            <LearningPath
              items={buildLockedPath(rows, lockedRequired, lockedSheet)}
              currentDotClass="bg-primary"
            />

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

      {/* 크레딧 부족 (Figma 2856-17959) — 시작하기 눌렀는데 크레딧이 모자랄 때 */}
      {shortageOpen && (
        <CreditShortagePopup
          required={SET_CREDIT_COST}
          onClose={() => setShortageOpen(false)}
        />
      )}

      {/* 건너뛰기 확정 토스트 (3715-9240) — 하단 네비 위 다크 바 */}
      <Toast
        show={!!skipToast}
        className="flex items-center gap-[8px] rounded-[14px] bg-[#23272b] px-[16px] py-[14px] shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
      >
          <span className="flex size-[20px] shrink-0 items-center justify-center rounded-full bg-[#ffdadc]">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M2.5 6.3 5 8.7 9.5 3.6"
                stroke="#ff385c"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="text-[14px] font-semibold leading-[1.4] text-white">
            {skipToast}부터 건너뛰었어
          </p>
      </Toast>

      {/* 시트 밖 실패 안내 — 브라우저 alert 대신 앱 팝업 */}
      {alertMsg && <ConfirmDialog title={alertMsg} onConfirm={() => setAlertMsg(null)} />}

      {/* 진단 완료 토스트 (3575-7884) — 다크 바 + "보기" → 해당 단원 상세 시트 */}
      <Toast
        show={!!doneToast}
        className="flex items-center gap-[8px] rounded-[16px] bg-[#40464c] p-[16px] backdrop-blur-[8px]"
      >
          <span className="flex size-[20px] shrink-0 items-center justify-center rounded-full bg-[#ffdadc]">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M2.5 6.3 5 8.7 9.5 3.6"
                stroke="#ff385c"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-[1.4] text-white">
            {doneToast} 약점 진단 완료!
          </p>
          <button
            type="button"
            onClick={viewDoneToastUnit}
            className="shrink-0 rounded-full bg-[#5e6368] p-[8px] text-[12px] font-semibold leading-[1.4] text-[#f8f8f8]"
          >
            보기
          </button>
      </Toast>
    </>
  )

  return { openUnit, openStartSheet, startTrialSet, startFreeSolve, sheetEl, element }
}

/** 서버 에러 응답(BaseResponse.message) 우선 추출 — 크레딧 부족 등 서버 문구를 그대로 보여준다 */
export function extractApiMessage(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const res = (error as { response?: { data?: { message?: string } } }).response
    return res?.data?.message ?? null
  }
  return null
}

/* --- 진단 시작·건너뛰기·선행 안내 시트 헬퍼 (2842-10194 · 2842-10966 · 3082-5687) --- */

/**
 * "{단원명}부터 건너뛸까?" 확인 본문 (PI-SHEET-JUMP · 3620-7138) —
 * 진단 시작 시트의 건너뛰기 모드와 추천 리빌의 "안배웠어요" 시트가 공유한다.
 */
export function SkipConfirmContent({
  unitName,
  unitLabel,
  skipUnits,
  error,
  saving,
  onCancel,
  onConfirm,
  desktopTopGap = false,
}: {
  unitName: string
  unitLabel: string
  /** 건너뛸 범위 — 이 단원부터 대단원 끝까지 (미리보기는 앞 3장) */
  skipUnits: { unitCode: string; name: string }[]
  error?: string | null
  saving: boolean
  onCancel: () => void
  onConfirm: () => void
  /** 웹 우측 패널(홈·지도) 전용 상단 여백 — 닫기(X) 버튼과의 간격 */
  desktopTopGap?: boolean
}) {
  const previews = skipUnits.slice(0, 3)
  return (
    <>
      <div className={clsx('flex w-full flex-col gap-[8px]', desktopTopGap && 'xl:pt-[36px]')}>
        <h2 className="text-[20px] font-semibold leading-[1.4] text-[#121417]">
          {unitName}부터 건너뛸까?
        </h2>
      </div>

      {/* 함께 건너뛰는 소단원 미니 카드 — 점선 박스 (PI-SHEET-JUMP) */}
      <div className="relative flex w-full flex-col items-center">
        <span className="relative z-[2] -mb-[15px] rounded-[8px] bg-[#fff1f2] p-[8px] text-[12px] font-semibold leading-[1.4] text-[#ff385c]">
          함께 건너뜀
        </span>
        <div className="rounded-[24px] border border-dashed border-[#ff8fa3] p-[20px]">
          <ul className="flex flex-col gap-[8px]">
            {previews.map((unit, i) => (
              <li
                key={unit.unitCode}
                className="flex h-[55px] w-[240px] items-center justify-between rounded-[16px] bg-[#f1f1f1] p-[12px]"
                style={{ opacity: 1 - i * 0.2 }}
              >
                <span className="min-w-0 truncate text-[12px] font-semibold leading-[1.4] text-[#5e6368]">
                  {unit.name}
                </span>
                <span className="shrink-0 rounded-[8px] bg-[#fff1f2] px-[9px] py-[6px] text-[9px] font-semibold leading-[1.4] text-[#ff385c]">
                  진단하기
                </span>
              </li>
            ))}
          </ul>
        </div>
        {skipUnits.length >= 3 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[110px] bg-gradient-to-b from-white/0 to-white"
          />
        )}
      </div>

      <ul className="flex w-full list-disc flex-col gap-[8px] pl-[20px]">
        <li className="text-[14px] font-medium leading-[1.4] text-[#23272b]">
          이 {unitLabel}을 건너뛰면{' '}
          <b className="font-bold text-[#121417]">뒤에 남은 {unitLabel}</b>도 같이 건너뛰어
        </li>
        <li className="text-[14px] font-medium leading-[1.4] text-[#5e6368]">
          건너뛴 {unitLabel}은 <b className="font-bold text-[#121417]">언제든지</b> 다시 진단할 수
          있어
        </li>
      </ul>

      {error && (
        <p className="w-full text-center text-[13px] font-medium text-primary">{error}</p>
      )}

      <div className="flex w-full gap-[8px]">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#f8f8f8] text-[16px] font-bold text-[#121417]"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving ? '저장 중…' : '건너뛰기'}
        </button>
      </div>
    </>
  )
}

/**
 * 학습 경로 타임라인 (Figma 3361-5402) — 점 + 점선 커넥터.
 *
 * 점 중심을 라벨 첫 줄 중심(위에서 10px)에 맞추고, 커넥터는 행 높이 전체를 써서
 * 다음 점까지 끊김 없이 잇는다.
 */
function LearningPath({
  items,
  currentDotClass = 'bg-[#121417]',
}: {
  items: { name: string; current: boolean }[]
  currentDotClass?: string
}) {
  return (
    <div className="flex w-full flex-col rounded-[16px] border border-[#e5e7ea] p-[20px]">
      {items.map((p, i) => {
        const last = i === items.length - 1
        return (
          <div key={p.name} className="flex items-stretch gap-[12px]">
            <div className="relative flex w-[10px] flex-none justify-center">
              {/* 커넥터 — 첫 행은 점 중심에서 시작하고 마지막 행은 점 중심에서 끝난다 */}
              {items.length > 1 && (
                <span
                  aria-hidden
                  className={clsx(
                    'absolute left-1/2 w-px -translate-x-1/2 border-l border-dashed border-[#d6d8db]',
                    i === 0 && 'bottom-0 top-[10px]',
                    i > 0 && !last && 'inset-y-0',
                    last && 'top-0 h-[10px]',
                  )}
                />
              )}
              <span
                className={clsx(
                  'relative mt-[5px] size-[10px] shrink-0 self-start rounded-full',
                  p.current ? currentDotClass : 'bg-[#d6d8db]',
                )}
              />
            </div>
            {/* 행 간격은 라벨 아래 패딩으로 — 레일이 그 높이까지 늘어나 커넥터가 이어진다 */}
            <span
              className={clsx(
                'text-[14px] leading-[20px]',
                !last && 'pb-[14px]',
                p.current ? 'font-bold text-[#121417]' : 'font-medium text-[#5e6368]',
              )}
            >
              {p.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

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
