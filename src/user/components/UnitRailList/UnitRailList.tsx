import { clsx } from 'clsx'
import type { UnitProgressRow } from '@/user/stores/trialProgressStore'
import styles from './styles/UnitRailList.module.scss'

interface UnitRailListProps {
  rows: UnitProgressRow[]
  /** 다음 차례 카드 보조 문구 ("오늘 풀 차례" · "N시간 뒤에 열려" 등). 없으면 미표시 */
  nextMeta?: string
  /** 진단 완료 카드 클릭 (홈 — 상세 시트 열기). 없으면 완료 카드는 표시 전용 */
  onDoneClick?: (row: UnitProgressRow) => void
}

/**
 * 유닛 진행 레일 리스트 (2026-08-13 회의 확정 — 홈·언락 공용)
 *
 * 카드 왼쪽 세로 레일이 진행 경로다 — 지나온 길(완료)은 primary 실선,
 * 다음 풀 노드는 핑(파동), 남은 길은 회색 선.
 * 카드는 번호·테두리 없이 상태만: 완료(기록·점수) / 다음(핑·스트로크 깜빡임) / 잠김(회색·자물쇠).
 */
export function UnitRailList({ rows, nextMeta, onDoneClick }: UnitRailListProps) {
  return (
    <ol className={styles.list}>
      {rows.map((row, i) => {
        const isNext = row.state === 'next'
        // "지나온 길" 은 이어진 구간만 — 중간 유닛만 진단된 비정상 데이터가 와도
        // 잠긴 카드 쪽으로 primary 선이 뻗지 않게 양 끝 상태를 함께 본다
        const prevDone = i > 0 && rows[i - 1].state === 'done'
        const nextRow = rows[i + 1]
        const traveledTop = prevDone && row.state !== 'locked'
        const traveledBottom = row.state === 'done' && nextRow && nextRow.state !== 'locked'

        const cardBody = (
          <>
            <span className={styles.rowBody}>
              <span className={styles.rowName}>{row.name}</span>
              {row.diagnosis && (
                <span className={styles.rowMeta}>
                  {row.diagnosis.minutes}분 | 정답 {row.diagnosis.correct}문제
                </span>
              )}
              {isNext && nextMeta && <span className={styles.rowMeta}>{nextMeta}</span>}
            </span>

            {row.diagnosis ? (
              <span className={clsx(styles.rowScore, row.diagnosis.weak && styles.rowScoreWeak)}>
                {row.diagnosis.score}점
              </span>
            ) : isNext ? null : (
              <span className={styles.rowLockIcon} aria-label="잠김">
                <LockIcon />
              </span>
            )}
          </>
        )

        const cardClass = clsx(
          styles.row,
          isNext && styles.rowNext,
          row.state === 'locked' && styles.rowLocked,
        )

        return (
          <li key={row.name} className={styles.item}>
            {/* 왼쪽 레일 — 위/아래 선 + 상태 점 */}
            <span className={styles.rail} aria-hidden>
              <span
                className={clsx(
                  styles.railLine,
                  i === 0 && styles.railLineHidden,
                  traveledTop && styles.railLineDone,
                )}
              />
              <span
                className={clsx(
                  styles.dot,
                  row.state === 'done' && styles.dotDone,
                  isNext && styles.dotNext,
                )}
              >
                {isNext && (
                  <>
                    <span className={styles.pulse} />
                    <span className={clsx(styles.pulse, styles.pulseLate)} />
                  </>
                )}
              </span>
              <span
                className={clsx(
                  styles.railLine,
                  i === rows.length - 1 && styles.railLineHidden,
                  traveledBottom && styles.railLineDone,
                )}
              />
            </span>

            {row.state === 'done' && onDoneClick ? (
              <button
                type="button"
                onClick={() => onDoneClick(row)}
                className={clsx(cardClass, styles.rowClickable)}
              >
                {cardBody}
              </button>
            ) : (
              <div className={cardClass}>{cardBody}</div>
            )}
          </li>
        )
      })}
    </ol>
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
