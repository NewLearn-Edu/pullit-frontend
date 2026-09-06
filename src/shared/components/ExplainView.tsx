import { clsx } from 'clsx'
import { useEffect, useState, type ReactNode } from 'react'
import { MathExplainRender } from './ExamRender'
import { ExamScaleFrame } from './ExamScaleFrame'
import type { ExplainBlock } from './ExamBlocks'
import {
  ProblemExplain,
  ProblemTranslation,
  ProblemVocabulary,
  parseExplainBlocks,
  parseTranslationParagraphs,
} from './ProblemExplain'
import styles from './ExplainView.module.scss'

/**
 * 해설 뷰 공용 조각 — 학생 문제풀이 우측 패널(ExplainPanel)과 어드민 미리보기(업로드·목록·검수·맛보기)가
 * 같은 탭 헤더 · 같은 본문 컴포넌트를 쓴다. 어드민에서 보이는 해설·해석이 곧 학생이 보는 화면이어야 하므로
 * 여기 밖에서 정답/해설/어휘/해석 조판을 따로 만들지 않는다.
 *
 * - 해석(translation)이 있으면 "해석 / 풀이" 두 탭, 없으면 "해설" 단일 라벨 (영어만 해석이 있다)
 * - 풀이 탭 = 정답 · 해설(3섹션 블록 렌더) · 어휘
 * - 해석 탭 = 지문 번역 문단
 */
export type ExplainTab = 'translation' | 'explain'

/** 해석 유무 판정 — 문단으로 해석되는 translation 이 있을 때만 탭을 만든다 */
export function hasTranslationTab(subject: string | null | undefined, translation: unknown): boolean {
  return String(subject ?? '').toLowerCase() === 'english' && parseTranslationParagraphs(translation) !== null
}

/** 탭 상태 — 해석이 있으면 해석부터(지문을 이해한 뒤 풀이). resetKey(문항)가 바뀌면 첫 탭으로 */
export function useExplainTab(hasTranslation: boolean, resetKey: string | number): [ExplainTab, (t: ExplainTab) => void] {
  const [tab, setTab] = useState<ExplainTab>(hasTranslation ? 'translation' : 'explain')
  useEffect(() => {
    setTab(hasTranslation ? 'translation' : 'explain')
  }, [resetKey, hasTranslation])
  return [hasTranslation ? tab : 'explain', setTab]
}

/** 객관식 정답 번호 → 원문자, 단답형은 값 그대로, 없으면 '-' */
export function formatAnswerDisplay(answerNo: number | null | undefined, isShortAnswer: boolean): string {
  if (answerNo == null) return '-'
  if (isShortAnswer) return String(answerNo)
  return ['①', '②', '③', '④', '⑤'][answerNo - 1] ?? '-'
}

export function ExplainTabBar({
  hasTranslation,
  activeTab,
  onChange,
}: {
  hasTranslation: boolean
  activeTab: ExplainTab
  onChange: (tab: ExplainTab) => void
}) {
  return (
    <div className={styles.tabs} role={hasTranslation ? 'tablist' : undefined}>
      {hasTranslation ? (
        (
          [
            ['translation', '해석'],
            ['explain', '풀이'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => onChange(key)}
            className={clsx(styles.tabButton, activeTab === key && styles.tabButtonActive)}
          >
            {label}
          </button>
        ))
      ) : (
        <span className={clsx(styles.tabButton, styles.tabButtonActive)}>해설</span>
      )}
    </div>
  )
}

export interface ExplainBodyProps {
  activeTab: ExplainTab
  /** 정답 표시 — 원문자(①) · 단답 값 · '-' */
  answerDisplay: ReactNode
  /** 블록 배열 · JSON 문자열 · 구 마크다운 문자열 */
  explanation: string | ExplainBlock[] | null | undefined
  subject?: string | null
  translation?: string | unknown[] | null
  vocabulary?: { term: string; meaning: string }[] | null
  /** 구 목 데이터 전용 — explanation 이 블록이 아니고 이 값이 있으면 "정답 분석 / 오답 분석" 두 섹션 */
  legacyWrongAnalysis?: string | null
}

export function ExplainBody({
  activeTab,
  answerDisplay,
  explanation,
  subject,
  translation,
  vocabulary,
  legacyWrongAnalysis,
}: ExplainBodyProps) {
  if (activeTab === 'translation') {
    return (
      <>
        {/* 해석 탭 — 지문 번역 문단 (밑줄 <u> 는 지문과 같은 위치에 보존) */}
        <p className={styles.answerLabel}>해석</p>
        <div style={{ marginTop: 12 }} className={styles.sections}>
          <ProblemTranslation translation={translation} />
        </div>
      </>
    )
  }

  const isLegacy = legacyWrongAnalysis !== undefined && parseExplainBlocks(explanation) === null
  const vocab = vocabulary && vocabulary.length > 0 ? vocabulary : null

  return (
    <>
      {/* 정답 — 타이틀 + 값 */}
      <p className={styles.answerLabel}>정답</p>
      <p className={styles.answerValue}>{answerDisplay}</p>

      {/* 해설 — 3섹션 블록([핵심 발상] · [풀이] · [선택지별 진단]) 또는 구 포맷 */}
      <p className={styles.answerLabel} style={{ marginTop: 28 }}>
        해설
      </p>
      <div style={{ marginTop: 12 }} className={styles.sections}>
        {isLegacy ? (
          <>
            <LegacySection title="정답 분석" body={typeof explanation === 'string' ? explanation : ''} />
            {legacyWrongAnalysis && <LegacySection title="오답 분석" body={legacyWrongAnalysis} />}
          </>
        ) : (
          <ProblemExplain explanation={explanation} subject={subject} />
        )}
      </div>

      {/* 어휘 — 영어 지문 핵심 단어 (풀이 탭 하단) */}
      {vocab && (
        <>
          <p className={styles.answerLabel} style={{ marginTop: 28 }}>
            어휘
          </p>
          <div style={{ marginTop: 12 }} className={styles.sections}>
            <ProblemVocabulary items={vocab} />
          </div>
        </>
      )}
    </>
  )
}

function LegacySection({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className={styles.sectionTitle}>{title}</p>
      <div className={styles.sectionBody}>
        <MathExplainRender text={body} />
      </div>
    </div>
  )
}

/**
 * 어드민 미리보기용 완성 뷰 — 탭 헤더 + 본문을 학생 패널과 같은 치수(헤더 48px · 본문 패딩)로 감싼다.
 * 학생 패널(ExplainPanel)은 패널 셸(열림/닫힘 · 필기 · 핀치줌)을 따로 갖고 있어 조각(TabBar · Body)만 가져다 쓴다.
 */
export function ExplainPreview({
  subject,
  answerDisplay,
  explanation,
  translation,
  vocabulary,
  resetKey,
  bare = false,
}: {
  subject?: string | null
  answerDisplay: ReactNode
  explanation: string | ExplainBlock[] | null | undefined
  translation?: string | unknown[] | null
  vocabulary?: { term: string; meaning: string }[] | null
  /** 문항이 바뀔 때 첫 탭으로 되돌리는 키 (problem_code 등) */
  resetKey: string | number
  /** 이미 ExamScaleFrame 카드 안에 그릴 때 — 프레임·헤더 패딩 없이 탭 + 본문만 */
  bare?: boolean
}) {
  const hasTranslation = hasTranslationTab(subject, translation)
  const [tab, setTab] = useExplainTab(hasTranslation, resetKey)
  const body = (
    <ExplainBody
      activeTab={tab}
      answerDisplay={answerDisplay}
      explanation={explanation}
      subject={subject}
      translation={translation}
      vocabulary={vocabulary}
    />
  )
  if (bare) {
    return (
      <div className={styles.bareRoot}>
        <div className={styles.bareHeader}>
          <ExplainTabBar hasTranslation={hasTranslation} activeTab={tab} onChange={setTab} />
        </div>
        {body}
      </div>
    )
  }
  return (
    <div className={styles.previewRoot}>
      <div className={styles.previewHeader}>
        <ExplainTabBar hasTranslation={hasTranslation} activeTab={tab} onChange={setTab} />
      </div>
      <div className={styles.previewBody}>
        {/* 500px 기준 고정 조판 → 폭 비례 확대 — 학생 패널과 동일 */}
        <ExamScaleFrame>{body}</ExamScaleFrame>
      </div>
    </div>
  )
}
