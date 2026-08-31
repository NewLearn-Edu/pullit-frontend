import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { useMe } from '@/user/hooks/useMe'
import { type Subject } from '@/user/stores/trialStore'
import { useTrialProgressStore } from '@/user/stores/trialProgressStore'
import { useUserStore } from '@/user/stores/userStore'
import { CURRICULUM } from '@/user/data/curriculum'
import { fetchUnitAverages, type UnitAverage } from '@/user/api/attemptApi'
import { Skeleton } from '@/user/components/Skeleton'
import styles from './styles/ScoreComparisonCard.module.scss'

/**
 * 평균 점수 비교 (Figma 2678-8996 · 2026-08-12 bullet chart 로 개편)
 *
 * 세로 막대 2개(내 점수 vs 평균)는 값 두 개를 보여주려고 카드를 통째로 쓰고,
 * 칩을 눌러가며 단원을 하나씩 봐야 해 비교 자체가 되지 않았다.
 * 가로 막대 + 평균 마커로 바꿔 한 화면에서 비교한다.
 * 2026-08-31 개편: 행 단위를 대분류 → 소단원으로. 대단원 완주 잠금이 사라지고
 * 진단한 소단원부터 하나씩 열린다. 평균은 실데이터(유저별 최신 진단 평균)로 교체.
 */
export function ScoreComparisonCard({ subject }: { subject: Subject }) {
  const [infoOpen, setInfoOpen] = useState(false)
  const infoDrag = useSheetDrag(() => setInfoOpen(false), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })

  // 세션 확립 — 리포트 직행 시에도 아래 sessionStatus 게이트가 열리도록 (조회 전용)
  useMe()
  // 내 점수 = 서버 진단 박제(trial_diagnoses) — 세션 확보 후 동기화 (홈과 동일)
  const diagnosed = useTrialProgressStore((s) => s.diagnosed)
  const hydrateFromServer = useTrialProgressStore((s) => s.hydrateFromServer)
  const sessionStatus = useUserStore((s) => s.status)

  // 진단 기록 + 풀잇 평균이 도착하기 전에는 차트 자리에 스켈레톤 —
  // 빈 데이터로 "미진단" 을 먼저 그렸다 갈아끼우는 깜빡임 방지
  const [loaded, setLoaded] = useState(false)
  const [averages, setAverages] = useState<Record<string, UnitAverage>>({})
  useEffect(() => {
    if (sessionStatus !== 'ready') return
    let alive = true
    const averagesReq = fetchUnitAverages(subject)
      .then((list) => {
        if (!alive) return
        const map: Record<string, UnitAverage> = {}
        for (const row of list) map[row.unitCode] = row
        setAverages(map)
      })
      .catch(() => {}) // 조회 실패 시 내 막대만 그린다
    Promise.allSettled([hydrateFromServer(), averagesReq]).then(() => {
      if (alive) setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [sessionStatus, subject, hydrateFromServer])

  // 대분류 칩 — 소단원 단위 비교라 진단한 것부터 하나씩 열린다 (대단원 완주 잠금 없음)
  const categories = CURRICULUM[subject]
  const [catSlug, setCatSlug] = useState(categories[0].slug)
  useEffect(() => {
    setCatSlug(CURRICULUM[subject][0].slug)
  }, [subject])
  const category = categories.find((c) => c.slug === catSlug) ?? categories[0]
  // 대단원의 모든 소단원을 그룹으로 — 미진단도 자리를 차지한다 ("미진단" 배지 + 점선 스텁).
  // 전체 지도가 보여야 "몇 개 남았는지"가 리포트에서 읽힌다 (2026-08-31)
  const rows = category.units.map((unit) => ({
    name: unit.name,
    // diagnosed 는 표시명 키 (trialProgressStore 가 group_code → 유닛명으로 변환해 저장)
    mine: diagnosed[unit.name]?.score ?? null,
    average: averages[unit.unitCode]?.averageScore ?? null,
  }))

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>평균 점수 비교</h2>
        <button
          type="button"
          aria-label="점수 계산 방식 안내"
          onClick={() => setInfoOpen(true)}
          className={styles.infoButton}
        >
          i
        </button>
      </header>

      <div className={styles.chips}>
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setCatSlug(c.slug)}
            className={clsx(styles.chip, category.slug === c.slug && styles.chipActive)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {!loaded && <Skeleton style={{ height: 214 }} radius={12} />}

      {loaded && (
      <div className={styles.groups}>
        {rows.map((row, i) => (
          <BarPair key={row.name} row={row} delay={i * 80} />
        ))}
      </div>
      )}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} aria-hidden />
          풀잇 평균
        </span>
        <span className={styles.legendItem}>
          <span className={clsx(styles.legendDot, styles.legendDotMine)} aria-hidden />
          내 점수
        </span>
      </div>

      {infoOpen && (
        <div className={styles.infoDim} onClick={infoDrag.close}>
          <div
            role="dialog"
            aria-label="점수 계산 방식"
            {...infoDrag.sheetProps}
            className={clsx(styles.infoSheet, infoDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={styles.infoHandle} aria-hidden />
            <h3 className={styles.infoTitle}>점수는 이렇게 계산해</h3>
            <p className={styles.infoDesc}>
              맞힌 문제의 배점을 모두 더한 뒤, 푼 문제의 배점 합으로 나눈 값이야.
              어려운 문제를 맞힐수록 점수가 크게 오르고, 오답 다시 풀기는 점수에 반영되지 않아.
            </p>
            <div className={styles.infoFormula}>맞힌 배점 합 ÷ 푼 배점 합 × 100</div>
            <button type="button" onClick={infoDrag.close} className={styles.infoClose}>
              확인했어
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * 소단원 하나 = 받침선 위 [풀잇 평균 | 내 점수] 세로 막대 쌍 + 아래 단원명 캡션.
 * "풀잇 평균" 라벨을 그룹마다 반복하지 않는다(하단 범례 1회) — 반복 라벨이
 * 그룹 경계를 지워 모바일에서 읽기 어렵던 문제 (2026-08-31).
 * 막대 높이 = 점수 × 1.4px (0점도 8px 스텁이 받침선 위에 선다).
 * 평균 기둥은 데이터가 있으면 그린다. 미진단 유닛의 내 자리는 막대 없이
 * "미진단" 텍스트만 — 고스트·점선 장식 없음 (2026-08-31 확정).
 */
function BarPair({
  row,
  delay,
}: {
  row: { name: string; mine: number | null; average: number | null }
  delay: number
}) {
  const barHeight = (score: number) => Math.max(8, Math.round(score * 1.4))
  const undiagnosed = row.mine == null
  return (
    <div className={styles.group}>
      {/* 받침선 위 쌍막대 — 선이 그룹마다 끊겨 짝이 눈에 바로 묶인다 */}
      <div className={styles.pair}>
        {row.average != null && (
          <div className={styles.col}>
            <span className={styles.badge}>{row.average}점</span>
            <div
              className={styles.bar}
              style={{ height: barHeight(row.average), animationDelay: `${delay}ms` }}
              aria-hidden
            />
          </div>
        )}
        <div className={styles.col}>
          {undiagnosed ? (
            // 막대 없이 텍스트만 — 진단 전이라는 사실만 담백하게
            <span className={styles.undiagnosed}>미진단</span>
          ) : (
            <>
              <span className={clsx(styles.badge, styles.badgeMine)}>{row.mine}점</span>
              <div
                className={clsx(styles.bar, styles.barMine)}
                style={{ height: barHeight(row.mine!), animationDelay: `${delay + 60}ms` }}
                aria-hidden
              />
            </>
          )}
        </div>
      </div>
      <span className={clsx(styles.groupName, undiagnosed && styles.groupNameGhost)}>
        {row.name}
      </span>
    </div>
  )
}
