import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import styles from './styles/ConfirmDialog.module.scss'

interface ConfirmDialogProps {
  title: ReactNode
  /** 부연 설명 — 없으면 제목만 */
  desc?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 파괴적 동작(나가기·삭제)이면 확인 버튼을 빨강으로 */
  danger?: boolean
  onConfirm: () => void
  /** 생략하면 버튼 하나짜리 안내 팝업(alert 대체) — 딤 클릭도 onConfirm 으로 닫힌다 */
  onCancel?: () => void
  /**
   * 딤(바깥) 클릭 시 동작 — 기본은 onCancel(없으면 onConfirm).
   * 왼쪽 버튼이 "나가기"처럼 되돌릴 수 없는 동작일 때, 딤 클릭은 그냥 팝업만 닫히게 따로 준다
   */
  onDismiss?: () => void
}

/**
 * 확인/안내 팝업 — window.confirm / window.alert 대체.
 * 문제 화면 "모르는 문제야?" 팝업과 같은 규격(가운데 카드 · 취소/확인 2버튼).
 * onCancel 이 없으면 확인 버튼 하나만 두는 안내 모드로 동작한다.
 */
export function ConfirmDialog({
  title,
  desc,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
  onDismiss,
}: ConfirmDialogProps) {
  const dismiss = onDismiss ?? onCancel ?? onConfirm
  return (
    <div className={styles.dim} onClick={dismiss}>
      <div
        role="alertdialog"
        aria-modal="true"
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.title}>{title}</p>
        {desc && <p className={styles.desc}>{desc}</p>}
        <div className={styles.actions}>
          {onCancel && (
            <button type="button" onClick={onCancel} className={styles.cancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={clsx(styles.ok, danger && styles.okDanger)}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
