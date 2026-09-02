import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { CreditShortagePopup } from '@/user/components/CreditShortagePopup'
import {
  declareUnitLock,
  fetchRecommendation,
  fetchUnitLocks,
  type Recommendation,
} from '@/user/api/recommendApi'
import { useCreditForExtraSet } from '@/user/api/creditApi'
import { setCreditUsedFlash } from '@/user/components/CreditUsedToast'
import { Toast } from '@/user/components/Toast'
import { CURRICULUM, UNIT_LABEL, type CurriculumCategory } from '@/user/data/curriculum'
import { SkipConfirmContent } from '@/user/pages/home/UnitSheets'
import { loadQuizProblems } from '@/user/services/problemSet'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { useTrialStore, type Subject } from '@/user/stores/trialStore'
import {
  computeCategoryProgress,
  SET_CREDIT_COST,
  useTrialProgressStore,
  type UnitProgressRow,
} from '@/user/stores/trialProgressStore'
import { isRecommendDemo, RECOMMEND_DEMO } from './recommendDemoData'
import styles from './styles/RecommendReveal.module.scss'

const SET_SIZE = 3

/**
 * 카드 높이는 콘텐츠 폭을 따라간다.
 *
 * 축소판은 실물 카드를 그대로 축소한 것이라 비율(폭 : 높이)이 보존된다. 높이를 77 로
 * 고정하면 화면이 넓어질수록 캔버스가 8:1 짜리 납작한 줄무늬가 된다. 폭의 22% 로 잡으면
 * 모바일(350)에서는 정확히 77 로 지금과 같고, 패드·웹에서는 카드가 같이 자라 비율이 유지된다.
 */
function cardHeightFor(width: number) {
  return Math.round(Math.min(112, Math.max(77, width * 0.22)))
}

/**
 * 캔버스 간격은 전부 "화면에서 몇 px 로 보일지" 로 정하고 배율은 여기서 역산한다.
 * 배율 1 기준으로 고정하면 칸이 많을 때 3~4px 로 눌려 다 붙어 보인다.
 */
const CANVAS_GAP = 7 // 카드 사이 · 대단원 블록 좌우
const CHIP_GAP = 12 // 대단원 칩 → 첫 카드
const BLOCK_GAP = 26 // 대단원 블록 위아래 (2열로 접혔을 때)
/** 한 줄에 다 늘어놨을 때 카드가 이보다 좁아지면 2열로 접는다 */
const FOLD_CARD_W = 140
/**
 * 확대가 끝난 카드의 글자 배수 (기준 16px).
 * 상세 카드 이름이 18px 이라 18/16 — 카드가 커지는 동안 글자도 거기까지 같이 커지고,
 * 상세로 넘어갈 때 크기 변화가 없어 교차가 매끄럽다.
 */
const ZOOM_TYPE = 18 / 16
/** 캔버스 최대 폭 — 초광폭에서 과하게 퍼지지 않게 (그 아래로는 콘텐츠 폭을 그대로 쓴다) */
const CANVAS_MAX_W = 900
/** 카드·상세 시트 최대 폭 — 캔버스와 달리 읽기 좋은 폭을 지킨다 */
const SHEET_MAX_W = 560

/**
 * 연출 단계.
 *  scan   전체 단원 캔버스를 훑는다 (추천 계산 대기)
 *  mark   추천 유닛에 빨간 테두리를 씌운다
 *  zoom   그 카드로 카메라가 들어간다 (배율 1 · 나머지는 사라짐)
 *  lift   카드가 제자리(최종 위치)로 올라간다
 *  expand 카드가 아래로 커지며 상세 카드가 되고 문구·스탯·CTA 가 붙는다
 */
type Phase = 'scan' | 'mark' | 'zoom' | 'lift' | 'expand' | 'ready'

const PHASE_MS = {
  settle: 420, // 다 훑고 한 박자 쉬는 시간
  mark: 700,
  zoom: 1000,
  lift: 480,
  expand: 560,
}

/** 전체를 훑는 데 쓰는 대략적인 시간 — 칸 수로 나눠 한 칸당 간격을 정한다 */
const SCAN_SWEEP_MS = 1500

/**
 * QA 훅 — 연출을 눈으로 뜯어볼 때만 쓴다 (일반 진입에는 영향 없음).
 *   ?rec-slow=4          배속 늦추기 (CSS 는 --rec-slow 로 같은 배율)
 *   ?rec-phase=zoom      단계 고정 — 그 단계의 최종 상태로 멈춰 있다
 *   ?rec-demo=1          서버 없이 고정 데이터로 (recommendDemoData)
 */
function qaSlow(): number {
  if (typeof window === 'undefined') return 1
  const raw = Number(new URLSearchParams(window.location.search).get('rec-slow'))
  return Number.isFinite(raw) && raw >= 1 && raw <= 20 ? raw : 1
}

const PHASES: Phase[] = ['scan', 'mark', 'zoom', 'lift', 'expand', 'ready']

function qaPhase(): Phase | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('rec-phase')
  return PHASES.find((p) => p === raw) ?? null
}

interface Cell {
  row: UnitProgressRow
  col: number
  idx: number
}

/**
 * 캔버스 한 칸 — 소단원 하나이거나, "안배웠어요" 로 잠긴 구간 전체다.
 * off 구간은 그 소단원부터 대단원 끝까지 이어지므로 한 덩어리로 묶어 그린다
 * (칸마다 자물쇠를 다는 것보다 "여기부터는 안배운 곳" 이 한눈에 읽힌다).
 */
interface Slot {
  kind: 'unit' | 'off'
  /** 시작 행 — 격자 세로 위치 계산용 */
  idx: number
  /** 몇 행을 차지하는지 (off 묶음은 2 이상) */
  span: number
  row?: UnitProgressRow
  rows?: UnitProgressRow[]
}

function toSlots(rows: UnitProgressRow[]): Slot[] {
  const slots: Slot[] = []
  let i = 0
  while (i < rows.length) {
    if (rows[i].state === 'off') {
      let j = i
      while (j < rows.length && rows[j].state === 'off') j += 1
      slots.push({ kind: 'off', idx: i, span: j - i, rows: rows.slice(i, j) })
      i = j
    } else {
      slots.push({ kind: 'unit', idx: i, span: 1, row: rows[i] })
      i += 1
    }
  }
  return slots
}

interface RecommendRevealProps {
  subject: Subject
}

/**
 * 추천 문제 리빌 (Figma PI-PAGE-Recommend01~06).
 *
 * 전체 단원을 한 장의 캔버스로 깔아 두고, 서버 추천이 도착하면 그 카드를 빨갛게 집어
 * 카메라가 들어가듯 확대한다. 확대가 끝나면 카드만 남아 위로 올라가고, 아래로 커지면서
 * 시작 시트가 된다 — "전체 중 지금 여기" 라는 위치 감각을 한 번에 주는 게 목적이다.
 *
 * 캔버스는 배율 1 짜리 그리드 하나를 통째로 transform: scale 한 것이고,
 * 무대(.stage)는 그 위를 잘라 보여주는 창이다. 단계마다 창의 위치·높이와
 * 그리드의 이동·배율만 바뀌므로 모든 구간이 하나의 카메라 워크로 이어진다.
 */
export default function RecommendReveal({ subject }: RecommendRevealProps) {
  const navigate = useNavigate()
  const { me } = useMe()
  const loadMe = useUserStore((s) => s.loadMe)
  const credit = me?.creditBalance ?? 0

  const categories = CURRICULUM[subject]

  const diagnosed = useTrialProgressStore((s) => s.diagnosed)
  const hydrateFromServer = useTrialProgressStore((s) => s.hydrateFromServer)
  const startUnit = useTrialProgressStore((s) => s.startUnit)

  const resetTrial = useTrialStore((s) => s.reset)
  const setLastSubject = useTrialStore((s) => s.setLastSubject)
  const setMathSkillNode = useTrialStore((s) => s.setMathSkillNode)
  const setEnglishType = useTrialStore((s) => s.setEnglishType)

  const [serverLocks, setServerLocks] = useState<Record<string, string>>({})
  const [serverRec, setServerRec] = useState<Recommendation | null>(null)
  const [failed, setFailed] = useState(false)
  const [phase, setPhase] = useState<Phase>('scan')
  /** 건너뛰기·모션 최소화 — 트랜지션 없이 최종 상태로 */
  const [instant, setInstant] = useState(false)

  // ── 데이터 ────────────────────────────────────────────────────────────────
  // 데모 모드에서는 서버를 타지 않고 고정 데이터로 연출만 돌린다
  const demo = isRecommendDemo() ? RECOMMEND_DEMO[subject] : null

  const load = useCallback(() => {
    setFailed(false)
    setServerRec(null)
    if (isRecommendDemo()) return
    // 진단 기록·잠금은 캔버스를 그리는 재료, 추천은 어느 카드를 집을지 결정한다
    hydrateFromServer().catch(() => {})
    fetchUnitLocks(subject)
      .then((list) => {
        const map: Record<string, string> = {}
        for (const lock of list) map[lock.categoryCode] = lock.offFromUnitCode
        setServerLocks(map)
      })
      .catch(() => {})
    fetchRecommendation(subject).then(setServerRec, () => setFailed(true))
  }, [subject, hydrateFromServer])

  useEffect(load, [load])

  const locks = demo ? demo.locks : serverLocks
  const rec = demo ? demo.recommendation : serverRec
  const marks = demo ? demo.diagnosed : diagnosed

  // ── 캔버스 격자 ───────────────────────────────────────────────────────────
  const categoryCode = (cat: CurriculumCategory) =>
    cat.units[0].unitCode.split('_').slice(0, 3).join('_')

  const columns = useMemo(
    () =>
      categories.map((cat) => {
        const rows = computeCategoryProgress(cat, marks, locks[categoryCode(cat)] ?? null).rows
        return { cat, rows, slots: toSlots(rows) }
      }),
    [categories, marks, locks],
  )

  const rowCount = useMemo(
    () => columns.reduce((max, c) => Math.max(max, c.rows.length), 0),
    [columns],
  )

  /**
   * 스캔 순서 — 대단원별로 위에서 아래로 한 칸씩. off 구간은 여러 소단원이지만
   * 통으로 묶여 한 칸으로 센다 ("여기부터는 안배운 곳" 을 한 번에 보여 주려고).
   */
  const scanSteps = useMemo(() => columns.reduce((n, c) => n + c.slots.length, 0), [columns])
  const [scanned, setScanned] = useState(0)
  /** 열 c 의 슬롯 s 가 스캔 순서상 몇 번째인지 */
  const scanIndexOf = useCallback(
    (col: number, slot: number) =>
      columns.slice(0, col).reduce((n, c) => n + c.slots.length, 0) + slot,
    [columns],
  )

  /** 추천 유닛의 격자 위치. 서버 추천이 없거나 못 찾으면 첫 미진단 유닛으로 대체한다 */
  const target = useMemo<Cell | null>(() => {
    const pick = (match: (r: UnitProgressRow) => boolean): Cell | null => {
      for (let col = 0; col < columns.length; col += 1) {
        const idx = columns[col].rows.findIndex(match)
        if (idx >= 0) return { row: columns[col].rows[idx], col, idx }
      }
      return null
    }
    if (rec && rec.type !== 'NONE' && rec.unitCode) {
      const hit = pick((r) => r.unitCode === rec.unitCode)
      if (hit) return hit
    }
    if (!rec) return null
    return pick((r) => r.state === 'next')
  }, [rec, columns])

  /** 추천이 끝났는데 집을 카드가 없다 = 전 대단원 진단 완료. 홈으로 돌려보낸다 */
  useEffect(() => {
    if (rec && !target) navigate('/home', { replace: true })
  }, [rec, target, navigate])

  // ── 단계 진행 ─────────────────────────────────────────────────────────────
  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const timers = useRef<number[]>([])
  const clearTimers = () => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
  }

  /**
   * 스캔 스윕 — 마운트하자마자 한 칸씩 훑는다. 추천 API 를 기다리는 시간이
   * 그대로 "지금 훑고 있다" 는 표시가 되도록 데이터 도착과 무관하게 먼저 돈다.
   */
  useEffect(() => {
    if (scanSteps === 0) return
    if (qaPhase() || reduceMotion) {
      setScanned(scanSteps)
      return
    }
    const step = Math.min(120, Math.max(50, SCAN_SWEEP_MS / scanSteps)) * qaSlow()
    let n = 0
    const id = window.setInterval(() => {
      n += 1
      setScanned(n)
      if (n >= scanSteps) window.clearInterval(id)
    }, step)
    return () => window.clearInterval(id)
  }, [scanSteps, reduceMotion])

  useEffect(() => {
    // 훑기가 끝나고 추천도 도착해야 다음 단계로 — 둘 중 늦은 쪽을 기다린다
    if (!target || phase !== 'scan' || scanned < scanSteps) return
    const pinned = qaPhase()
    if (pinned) {
      setInstant(true)
      setPhase(pinned)
      return
    }
    if (reduceMotion) {
      setInstant(true)
      setPhase('ready')
      return
    }
    // 각 단계는 앞 단계가 끝나는 시각에 시작한다 (누적 지연)
    const chain = ['mark', 'zoom', 'lift', 'expand'] as const
    const k = qaSlow()
    let at = PHASE_MS.settle * k // 다 훑고 한 박자 쉰 뒤 집는다
    const queued: number[] = []
    for (const next of chain) {
      queued.push(window.setTimeout(() => setPhase(next), at))
      at += PHASE_MS[next] * k
    }
    queued.push(window.setTimeout(() => setPhase('ready'), at))
    timers.current = queued
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduceMotion, scanned, scanSteps])

  // ── 무대 좌표 ─────────────────────────────────────────────────────────────
  const bodyRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [detailH, setDetailH] = useState(131)

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const measure = () => {
      setBox({ w: el.clientWidth, h: el.clientHeight })
      if (detailRef.current) setDetailH(detailRef.current.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (detailRef.current) ro.observe(detailRef.current)
    return () => ro.disconnect()
  }, [rec, target])

  const geo = useMemo(() => {
    const W = box.w || 335
    const bodyH = box.h || 420
    // 카드·상세 시트 폭과 캔버스 폭을 분리한다. 넓은 화면에서 캔버스는 시원하게 펴지되
    // 최종 시트는 읽기 좋은 폭을 지키게 — 둘을 묶으면 웹에서 시트가 1000px 로 늘어난다.
    const sheetW = Math.min(W, SHEET_MAX_W)
    const cardH = cardHeightFor(sheetW)
    const rows = Math.max(1, rowCount)
    const capW = Math.min(W, CANVAS_MAX_W)
    // 캔버스 구간에는 본문에 다른 게 안 보이므로 세로도 거의 다 쓴다 (위아래 숨통만 남기고)
    const capH = Math.max(160, bodyH - 56)
    /**
     * 대단원 블록 배치 — 기본은 한 줄. 한 줄로 늘어놨을 때 카드가 너무 좁아지는
     * 화면(주로 폰)에서만 2열로 접는다. 기기 breakpoint 가 아니라 "카드가 몇 px 로
     * 보이는가" 로 판단해야 가로 모드·좁은 창까지 자연스럽게 걸린다.
     */
    const n = Math.max(1, columns.length)
    const oneRowCardW = (capW - (n - 1) * CANVAS_GAP) / n
    const blockCols = n > 3 && oneRowCardW < FOLD_CARD_W ? Math.ceil(n / 2) : n
    const blockRows = Math.ceil(n / blockCols)
    // 대단원 칩은 블록 머리에 들어간다 — 높이를 격자 단위로 못 박아야 위치 계산이 확정된다.
    // 0.55 는 축소했을 때 홈 칩(14px 글자 + 상하 6 패딩 ≈ 32px)과 같은 높이가 되는 비율
    const chipH = Math.round(cardH * 0.55)
    // 간격은 배율과 무관하게 화면상 고정이므로 배율 식에서 상수로 빠진다 (순환 없음)
    const fixedV =
      CANVAS_GAP * blockRows * (rows - 1) + // 카드 사이
      CHIP_GAP * blockRows + // 칩 → 첫 카드
      BLOCK_GAP * (blockRows - 1) // 블록 줄 사이
    const scale = Math.min(
      (capW - (blockCols - 1) * CANVAS_GAP) / (blockCols * sheetW),
      (capH - fixedV) / (blockRows * (chipH + rows * cardH)),
    )
    const gap = CANVAS_GAP / scale
    const chipGap = CHIP_GAP / scale
    const blockGap = BLOCK_GAP / scale
    const blockH = chipH + chipGap + rows * cardH + (rows - 1) * gap
    const gridW = blockCols * sheetW + (blockCols - 1) * gap
    const gridH = blockRows * blockH + (blockRows - 1) * blockGap
    const canvasW = gridW * scale
    const canvasH = gridH * scale
    /**
     * 캔버스에서 글자를 얼마나 키워 둘지 — 카드가 배율만큼 작아지면 16px 이름이
     * 화면에서 7~8px 로 떨어져 못 읽는다. 배율의 역수만큼 키워 두면 축소된 뒤에도
     * 목표 크기로 읽힌다 (지도 라벨과 같은 원리). 확대되는 동안 1 로 돌아오므로
     * 카드가 커지는 만큼 글자는 제자리 — 최종 카드는 원래 규격 그대로다.
     */
    const onScreenCardW = sheetW * scale
    const onScreenCardH = cardH * scale
    // 가로(줄 길이)와 세로(카드 높이) 중 빡빡한 쪽에 맞춘다 — 세로가 눌린 창에서
    // 폭만 보고 키우면 글자가 카드를 꽉 채워 답답해진다
    const targetFont = Math.min(
      14,
      Math.max(9, Math.min(onScreenCardW * 0.115, onScreenCardH * 0.3)),
    )
    const typeScale = Math.min(3, Math.max(1, targetFont / (16 * scale)))
    const canvasY = Math.max(0, (bodyH - canvasH) / 2)
    return {
      W,
      sheetW,
      typeScale,
      sheetX: (W - sheetW) / 2,
      cardH,
      chipH,
      chipGap,
      blockCols,
      blockH,
      blockGap,
      gap,
      gridW,
      gridH,
      scale,
      canvasW,
      canvasH,
      canvasY,
      canvasX: (W - canvasW) / 2,
      // 확대가 끝난 카드는 캔버스가 있던 자리의 한가운데에 선다
      zoomY: canvasY + (canvasH - cardH) / 2,
    }
  }, [box, columns.length, rowCount])

  /** 단계별 무대(창)와 그리드 변환 — 이 두 값만으로 전 구간이 이어진다 */
  const shot = useMemo(() => {
    const onCanvas = phase === 'scan' || phase === 'mark'
    if (onCanvas) {
      return {
        left: geo.canvasX,
        width: geo.canvasW,
        top: geo.canvasY,
        height: geo.canvasH,
        gx: 0,
        gy: 0,
        gs: geo.scale,
      }
    }
    // 확대 뒤로는 창이 곧 카드다 — 시트 폭으로 좁혀져 가운데에 선다.
    // 대상 카드의 격자 좌표: 블록 위치 + 블록 안 칩·카드 오프셋
    const bc = target ? target.col % geo.blockCols : 0
    const br = target ? Math.floor(target.col / geo.blockCols) : 0
    const tx = bc * (geo.sheetW + geo.gap)
    const ty =
      br * (geo.blockH + geo.blockGap) +
      geo.chipH +
      geo.chipGap +
      (target ? target.idx : 0) * (geo.cardH + geo.gap)
    const box = {
      left: geo.sheetX,
      width: geo.sheetW,
      gx: -tx,
      gy: -ty,
      gs: 1,
    }
    if (phase === 'zoom') return { ...box, top: geo.zoomY, height: geo.cardH }
    if (phase === 'lift') return { ...box, top: 0, height: geo.cardH }
    return { ...box, top: 0, height: detailH }
  }, [phase, geo, target, detailH])

  // ── 시작하기 · 안배웠어요 ─────────────────────────────────────────────────
  const [estimatedSec, setEstimatedSec] = useState<number | null>(null)
  useEffect(() => {
    if (!target) return
    let alive = true
    loadQuizProblems(
      subject,
      target.row.nodeId ?? (subject === 'math' ? 'sn-exp-log-01' : 'en-blank'),
    ).then((problems) => {
      if (alive && problems.length > 0) setEstimatedSec(problems.reduce((s, p) => s + p.tRecSec, 0))
    })
    return () => {
      alive = false
    }
  }, [target, subject])

  const [skipMode, setSkipMode] = useState(false)
  const [starting, setStarting] = useState(false)
  // 크레딧 부족 팝업 (2856-17959) — 시작하기를 눌렀을 때 안내 (버튼 비활성 대신)
  const [shortageOpen, setShortageOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  /** 시작하기 — 홈 시작 시트와 같은 규칙 (서버 크레딧 차감 성공 시에만 진입) */
  const confirmStart = async () => {
    if (!target || starting) return
    if (credit < SET_CREDIT_COST) {
      setShortageOpen(true)
      return
    }
    setStarting(true)
    setActionError(null)
    try {
      await useCreditForExtraSet()
      setCreditUsedFlash(SET_CREDIT_COST, credit - SET_CREDIT_COST) // 첫 문제 화면 토스트
      loadMe(true)
      resetTrial()
      setLastSubject(subject)
      const nodeId = target.row.nodeId ?? (subject === 'math' ? 'sn-exp-log-01' : 'en-blank')
      if (subject === 'math') setMathSkillNode(nodeId)
      else setEnglishType(nodeId)
      startUnit({ unitName: target.row.name, returnTo: '/home' })
      navigate(`/trial/quiz/${subject}/0`)
    } catch {
      setActionError('크레딧 사용에 실패했어. 잔액을 확인하고 다시 시도해줘')
      setStarting(false)
    }
  }

  // 건너뛰기 확정 토스트 (3631-9044) — 재분석 화면 위 "{단원명}부터 건너뛰었어"
  const [skipToast, setSkipToast] = useState<string | null>(null)
  useEffect(() => {
    if (!skipToast) return
    const timer = window.setTimeout(() => setSkipToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [skipToast])

  /** 안배웠어요 — 이 유닛부터 대단원 끝까지 잠그고 추천을 다시 계산한다 */
  const confirmSkipUnit = async () => {
    if (!target || saving) return
    setSaving(true)
    setActionError(null)
    try {
      await declareUnitLock(subject, target.row.unitCode)
      setSkipMode(false)
      setSkipToast(target.row.name)
      // 잠근 구간이 캔버스에 반영되도록 처음부터 다시 훑는다
      setPhase('scan')
      setInstant(false)
      setScanned(0)
      load()
    } catch {
      setActionError('잠금 저장에 실패했어. 다시 시도해줘')
    } finally {
      setSaving(false)
    }
  }

  const closeToHome = () => navigate('/home', { replace: true })

  // ── 실패 ──────────────────────────────────────────────────────────────────
  if (failed) {
    return (
      <div className={styles.page}>
        <OnboardingHeader onClose={closeToHome} />
        <main className={styles.errorMain}>
          <p className={styles.errorTitle}>추천 문제를 못 불러왔어</p>
          <p className={styles.errorDesc}>잠깐 후에 다시 시도해줄래?</p>
          <div className={styles.errorActions}>
            <button type="button" onClick={closeToHome} className={styles.ghostButton}>
              홈으로
            </button>
            <button type="button" onClick={load} className={styles.primaryButton}>
              다시 시도
            </button>
          </div>
        </main>
      </div>
    )
  }

  const onCanvas = phase === 'scan' || phase === 'mark'
  /** 확대가 끝난 시점 — 여기서 그리드를 끄고 무대가 카드를 직접 들기 시작한다 */
  const solo = phase === 'lift' || phase === 'expand' || phase === 'ready'
  const revealed = phase === 'expand' || phase === 'ready'
  const badge = unitBadge(rec, target?.row)
  const reason = defaultReason(target?.row)
  // 시안(3591-10490) '추천 기준' 행은 짧은 기준 문구 — 서버 문장형 reason 대신 로컬 판정
  const targetCategory = target ? categories[target.col] : null

  return (
    <div
      className={clsx(styles.page, instant && styles.instant)}
      style={
        {
          '--rec-slow': qaSlow(),
          '--rec-card-h': `${geo.cardH}px`,
          '--rec-sheet-w': `${geo.sheetW}px`,
          // 캔버스에서는 축소를 상쇄할 만큼 키워 두고, 확대되는 동안 상세 카드 크기까지 줄어든다
          '--rec-type': onCanvas ? geo.typeScale : ZOOM_TYPE,
          // 대단원 칩은 단계와 무관하게 캔버스 배수를 유지한다 — --rec-type 을 같이 쓰면
          // 확대가 시작되는 프레임에 값만 바뀌고(트랜지션 없음) 칩이 팍 작아진다
          '--rec-chip-type': geo.typeScale,
        } as CSSProperties
      }
    >
      <OnboardingHeader onClose={closeToHome} />

      <main className={styles.main}>
        {/* 문구 크로스페이드 — 훑는 중 ↔ 찾았다 */}
        <div className={styles.titleBlock}>
          <div className={clsx(styles.titleLayer, revealed && styles.titleLayerOut)}>
            <h1 className={styles.title}>지금 풀어야 할 문제를 찾아줄게</h1>
            <p className={styles.subtitle}>
              {subject === 'math' ? '수학' : '영어'} 학습 기록 조회중
              <Ellipsis />
            </p>
          </div>
          <div className={clsx(styles.titleLayer, !revealed && styles.titleLayerOut)}>
            <h1 className={styles.title}>지금 필요한 추천문제</h1>
            <p className={styles.subtitle}>현재 학습 상태에 맞춰 문제를 골랐어</p>
          </div>
        </div>

        <div className={styles.body} ref={bodyRef}>
          {/* 무대 — 캔버스를 잘라 보여주는 창. 단계마다 위치·높이만 바뀐다 */}
          <div
            className={clsx(
              styles.stage,
              onCanvas && styles.stageStill,
              !onCanvas && styles.stageZoomed,
              solo && styles.stageSolo,
              revealed && styles.stageDetail,
            )}
            style={{
              left: `${shot.left}px`,
              width: `${shot.width}px`,
              top: `${shot.top}px`,
              height: `${shot.height}px`,
            }}
          >
            {/* 확대가 끝나는 순간 그리드를 끈다 — 그 프레임에서 대상 카드와 무대가 정확히 겹친다 */}
            {!solo && (
              <div
                className={styles.grid}
                style={{
                  gridTemplateColumns: `repeat(${geo.blockCols}, ${geo.sheetW}px)`,
                  columnGap: `${geo.gap}px`,
                  rowGap: `${geo.blockGap}px`,
                  transform: `translate(${shot.gx}px, ${shot.gy}px) scale(${shot.gs})`,
                }}
                aria-hidden
              >
                {columns.map(({ cat, rows, slots }, col) => (
                  <div key={cat.slug} className={styles.column}>
                    {/* 대단원 칩 — 블록 머리. 추천이 나온 대단원은 홈처럼 활성(검정)으로 */}
                    <span
                      className={clsx(
                        styles.columnChip,
                        target?.col === col && phase !== 'scan' && styles.columnChipActive,
                        !onCanvas && styles.columnChipOut,
                      )}
                      style={{
                        height: `${geo.chipH}px`,
                        marginBottom: `${geo.chipGap}px`,
                      }}
                    >
                      {cat.name}
                    </span>
                    <div className={styles.columnCards} style={{ gap: `${geo.gap}px` }}>
                      {slots.map((slot, s) => {
                        const order = scanIndexOf(col, s)
                        const state =
                          order < scanned - 1 ? 'done' : order === scanned - 1 ? 'now' : 'pending'
                        const isTarget = !!target && target.col === col && target.idx === slot.idx
                        // 집힌 뒤에는 주변을 눌러 두고(dim), 카메라가 들어가면 완전히 뺀다.
                        // 축소판은 글자가 안 읽히니 "어디가 내 자리인지" 는 명암으로 말한다.
                        const mute = isTarget
                          ? 'none'
                          : phase === 'zoom'
                            ? 'hide'
                            : phase === 'mark'
                              ? 'dim'
                              : 'none'

                        if (slot.kind === 'off') {
                          return (
                            <OffGroup
                              key={`off-${slot.idx}`}
                              rows={slot.rows!}
                              scan={state}
                              mute={mute}
                            />
                          )
                        }
                        return (
                          <UnitCard
                            key={slot.row!.unitCode}
                            row={slot.row!}
                            marked={isTarget && phase !== 'scan'}
                            scan={state}
                            mute={mute}
                          />
                        )
                      })}
                      {/* 열마다 길이가 달라 남는 행 — 격자 정렬만 맞춘다 */}
                      {Array.from({ length: rowCount - rows.length }, (_, i) => (
                        <div key={`pad-${i}`} className={styles.cardSpacer} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 확대가 끝난 뒤의 카드 — 그리드의 대상 카드와 픽셀이 겹치는 자리에서 이어받는다 */}
            {target && solo && (
              <div className={clsx(styles.solo, revealed && styles.soloOut)} aria-hidden>
                <UnitCard row={target.row} marked bare />
              </div>
            )}

            {/* 아래로 커지며 드러나는 상세 카드 */}
            {/* 폭을 못 박아 둬야 창이 캔버스만 할 때도 높이를 제대로 잰다 */}
            <div
              ref={detailRef}
              className={clsx(styles.detail, revealed && styles.detailIn)}
              style={{ width: `${geo.sheetW}px` }}
              aria-hidden={!revealed}
            >
              <div className={styles.detailHead}>
                <p className={styles.detailCategory}>{targetCategory?.name ?? ''}</p>
                <div className={styles.detailNameRow}>
                  <p className={styles.detailName}>{target?.row.name ?? ''}</p>
                  <span className={clsx(styles.detailBadge, badge.weak && styles.detailBadgeWeak)}>
                    {badge.text}
                  </span>
                </div>
              </div>
              <div className={styles.detailFoot}>
                <span className={styles.detailReasonLabel}>추천 기준</span>
                <p className={styles.detailReason}>{reason}</p>
              </div>
            </div>
          </div>

          {/* 상세 카드가 차지할 자리 — 무대가 그 위에 겹쳐 앉는다 */}
          <div style={{ height: `${detailH}px` }} aria-hidden />

          <div className={clsx(styles.stats, revealed && styles.statsIn)}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>문제 수</span>
              <span className={styles.statValue}>{SET_SIZE}문제</span>
            </div>
            <span className={styles.statDivider} aria-hidden />
            <div className={styles.stat}>
              <span className={styles.statLabel}>예상 시간</span>
              <span className={styles.statValue}>
                {estimatedSec != null
                  ? `약 ${Math.max(1, Math.round(estimatedSec / 60))}분`
                  : '약 —분'}
              </span>
            </div>
            <span className={styles.statDivider} aria-hidden />
            <div className={styles.stat}>
              <span className={styles.statLabel}>필요 크레딧</span>
              <span className={styles.statValue}>{SET_CREDIT_COST}개</span>
            </div>
          </div>
        </div>
      </main>

      {/* 하단 고정 — 연출이 끝나야 뜬다 */}
      <footer
        className={clsx(styles.dock, revealed && styles.dockIn)}
      >
        <div className={styles.creditRow}>
          <CoinIcon />
          <span className={styles.creditLabel}>보유 크레딧:</span>
          <span className={styles.creditValue}>{credit}개</span>
        </div>
        {actionError && <p className={styles.actionError}>{actionError}</p>}
        {/* CTA 정책 (2026-08-31): 미진단 = "{단원명} 진단하기" · 진단한(약점 포함) = 추천 문제 풀기.
            "안배웠어요"는 미진단 추천에서만 — 아래 텍스트 링크 (3591-10490) */}
        <div className={styles.dockActions}>
          <button
            type="button"
            onClick={confirmStart}
            disabled={starting}
            className={styles.darkButton}
          >
            {starting
              ? '시작 중…'
              : target?.row.diagnosis
                ? '추천 문제 풀기'
                : `${target?.row.name ?? ''} 진단하기`.trim()}
          </button>
          {!target?.row.diagnosis && (
            <button
              type="button"
              onClick={() => setSkipMode(true)}
              className={styles.skipLink}
            >
              이 단원 아직 안배웠어요
            </button>
          )}
        </div>
      </footer>

      {/* "안배웠어요" — 건너뛰기 확인 (3620-7138) — 홈·지도와 같은 본문 공유.
          모바일·패드 = 바텀 시트 · 웹 = 중앙 다이얼로그 (이어풀기 팝업과 같은 패턴) */}
      {skipMode && target && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(21,17,18,0.38)] xl:items-center xl:p-[20px]"
          onClick={() => setSkipMode(false)}
        >
          <div
            className="flex w-full max-w-[620px] flex-col items-center gap-[24px] rounded-t-[32px] bg-white px-[20px] pb-[calc(28px+env(safe-area-inset-bottom))] pt-[16px] shadow-[0_-16px_25px_rgba(0,0,0,0.12)] xl:max-w-[440px] xl:rounded-[24px] xl:p-[28px] xl:shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="h-[5px] w-[42px] rounded-full bg-[#d6d8db] xl:hidden" aria-hidden />
            <SkipConfirmContent
              unitName={target.row.name}
              unitLabel={UNIT_LABEL[subject]}
              skipUnits={(() => {
                const units = targetCategory?.units ?? []
                const fromIdx = units.findIndex((u) => u.unitCode === target.row.unitCode)
                return fromIdx >= 0 ? units.slice(fromIdx) : [target.row]
              })()}
              error={actionError}
              saving={saving}
              onCancel={() => setSkipMode(false)}
              onConfirm={confirmSkipUnit}
            />
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

      {/* 건너뛰기 확정 토스트 (3631-9044) — 재분석 화면 위 다크 바 */}
      <Toast
        show={!!skipToast}
        bottom="calc(28px + env(safe-area-inset-bottom))"
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
          <p className="text-[16px] font-semibold leading-[1.4] text-white">
            {skipToast}부터 건너뛰었어
          </p>
      </Toast>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 캔버스 카드 — 홈 소단원 카드와 같은 4상태. 축소된 채로 깔려 있다가 확대되면 읽힌다.
// bare=true 는 무대가 직접 들고 있는 단독 카드 (배경·테두리는 무대가 그린다)
// ─────────────────────────────────────────────────────────────────────────────

type ScanState = 'pending' | 'now' | 'done'

function UnitCard({
  row,
  marked,
  bare,
  mute = 'none',
  scan = 'done',
}: {
  row: UnitProgressRow
  marked?: boolean
  bare?: boolean
  mute?: 'none' | 'dim' | 'hide'
  scan?: ScanState
}) {
  const locked = row.state === 'locked'
  const next = row.state === 'next'
  const done = !!row.diagnosis
  // 스캔이 지나가기 전에는 결과를 숨긴다 — 지나가는 순간 상태가 드러나야 "체크" 로 읽힌다
  const revealed = scan !== 'pending'
  return (
    <div
      className={clsx(
        styles.card,
        bare && styles.cardBare,
        // 마스터 카드: 진단·다음 차례는 흰 카드, 순서상 잠긴 칸은 회색 + 미진단 필
        !marked && revealed && (locked ? styles.cardLockedBg : styles.cardDone),
        !marked && revealed && next && styles.cardNext,
        !marked && !revealed && styles.cardIdle,
        marked && styles.cardMarked,
        !revealed && styles.cardPendingScan,
        scan === 'now' && styles.cardScanning,
        mute === 'dim' && styles.cardDim,
        mute === 'hide' && styles.cardHide,
      )}
    >
      <div className={styles.cardBody}>
        <span className={clsx(styles.cardName, locked && !marked && styles.cardNameLocked)}>
          {row.name}
        </span>
        {/* 메타는 집힌 카드에서만 — 축소판에서는 읽히지도 않으면서 줄만 늘린다 */}
        {marked && row.diagnosis && (
          <span className={styles.cardMeta}>
            푼 문제 수 {row.diagnosis.items?.length ?? SET_SIZE}개 · {row.diagnosis.minutes}분
          </span>
        )}
      </div>
      {/* 마스터 카드(2246-6010 · 3631-9044 캔버스): 진단 = 점수, 순서 잠김 = "미진단" 필,
          다음 차례·집힌 미진단 = "진단하기" 필. 자물쇠 표기는 폐지 */}
      {revealed &&
        (done ? (
          // 애니메이션 캔버스에는 셰브런 없이 점수만 (3681-8056) — 셰브런은 홈 리스트 전용
          <span className={clsx(styles.cardCheck, row.diagnosis?.weak && styles.cardCheckWeak)}>
            {row.diagnosis?.score}점
          </span>
        ) : locked && !marked ? (
          <span className={styles.cardStatePill}>미진단</span>
        ) : (
          <span className={styles.cardPill}>진단하기</span>
        ))}
    </div>
  )
}

/**
 * "안배웠어요"(건너뛴) 구간 — 개별 회색 카드 + "건너뜀" 필 (3631-9044 · 3693-8663 개정:
 * 잠금 스택·자물쇠 폐지). 부모 격자의 gap 을 그대로 써서 다른 열과의 정렬이 유지된다.
 */
function OffGroup({
  rows,
  scan,
  mute,
}: {
  rows: UnitProgressRow[]
  scan: ScanState
  mute: 'none' | 'dim' | 'hide'
}) {
  const revealed = scan !== 'pending'
  return (
    <>
      {rows.map((row) => (
        <div
          key={row.unitCode}
          className={clsx(
            styles.card,
            styles.cardSkipped,
            !revealed && styles.cardPendingScan,
            scan === 'now' && styles.cardScanning,
            mute === 'dim' && styles.cardDim,
            mute === 'hide' && styles.cardHide,
          )}
        >
          <div className={styles.cardBody}>
            <span className={clsx(styles.cardName, styles.cardNameSkipped)}>{row.name}</span>
          </div>
          <span className={styles.cardStatePill}>건너뜀</span>
        </div>
      ))}
    </>
  )
}

/** 상세 카드 배지 — 미진단이면 회색 '진단 전', 복습이면 점수(약점은 빨강) */
function unitBadge(rec: Recommendation | null, row?: UnitProgressRow) {
  if (row?.diagnosis) {
    return { text: `${row.diagnosis.score}점`, weak: row.diagnosis.weak }
  }
  if (rec?.type === 'REVIEW' && rec.score != null) {
    return { text: `${rec.score}점`, weak: rec.score < 70 }
  }
  return { text: '진단 전', weak: false }
}

/** "추천 기준" 행의 짧은 사유 (3591-10490) — 문장형 대신 기준만 담백하게 */
function defaultReason(row?: UnitProgressRow) {
  if (row?.diagnosis) {
    return row.diagnosis.weak ? '점수가 가장 낮은 약점 단원' : '점수가 가장 낮은 단원'
  }
  return '아직 진단하지 않은 단원'
}

/** 조회중 말줄임 — 점 3개가 차례로 켜진다 */
function Ellipsis() {
  return (
    <span className={styles.ellipsis} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  )
}

function CoinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="#FFC93C" />
      <circle cx="10" cy="10" r="5.2" fill="#FFDE7D" />
      <path
        d="M10 6.6v6.8M8 8.2h3a1.4 1.4 0 0 1 0 2.8H8"
        stroke="#B4801A"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
