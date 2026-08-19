import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  fetchAdminPolicies,
  fetchAdminPolicyVersions,
  publishAdminPolicy,
  type PolicySlug,
  type PolicySummary,
  type PolicyVersion,
} from '../api/adminApi'
import { useToast } from '../components/toast'

/** "2026-08-19T04:00:00" → "2026-08-19 04:00" (목록·이력 표기) */
function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 16).replace('T', ' ')
}

/**
 * 정책 관리 — 법적 고지문(이용약관·개인정보 처리방침·마케팅 수신동의) 게시.
 *
 * 법적 증빙을 위해 수정·삭제가 없다 — 개정은 항상 새 버전 게시이고,
 * 시행일을 미래로 잡으면 그 시각부터 학생 화면(/policies/*)이 자동 전환된다.
 */
export default function PoliciesPage() {
  const toast = useToast()

  const [summaries, setSummaries] = useState<PolicySummary[]>([])
  const [selected, setSelected] = useState<PolicySlug | null>(null)
  const [versions, setVersions] = useState<PolicyVersion[]>([])

  // 에디터 상태 — 선택 시 최신 버전으로 프리필
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [effectiveAt, setEffectiveAt] = useState('') // datetime-local 값, 빈 값 = 즉시 시행
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [publishing, setPublishing] = useState(false)

  const loadSummaries = useCallback(() => {
    fetchAdminPolicies()
      .then(setSummaries)
      .catch(() => toast('정책 목록을 불러오지 못했어요'))
  }, [toast])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  const select = (slug: PolicySlug) => {
    setSelected(slug)
    setMode('edit')
    setEffectiveAt('')
    setVersions([])
    fetchAdminPolicyVersions(slug)
      .then((list) => {
        setVersions(list)
        // 최신 버전 프리필 — 처음 게시하는 문서면 빈 에디터
        setTitle(list[0]?.title ?? '')
        setContent(list[0]?.content ?? '')
      })
      .catch(() => toast('버전 이력을 불러오지 못했어요'))
  }

  /** 이전 버전 본문을 에디터로 — 그 내용을 바탕으로 새 버전을 만든다 (롤백도 새 버전 게시) */
  const loadVersion = (version: PolicyVersion) => {
    setTitle(version.title)
    setContent(version.content)
    setMode('edit')
    toast(`v${version.version} 내용을 에디터로 불러왔어요`)
  }

  const publish = async () => {
    if (!selected || !title.trim() || !content.trim() || publishing) return
    const effectiveLabel = effectiveAt ? `${effectiveAt.replace('T', ' ')} 시행` : '즉시 시행'
    if (!window.confirm(`새 버전으로 게시할까요? (${effectiveLabel})\n게시 후에는 수정할 수 없어요.`)) {
      return
    }
    setPublishing(true)
    try {
      const published = await publishAdminPolicy(selected, {
        title: title.trim(),
        content,
        effectiveAt: effectiveAt ? `${effectiveAt}:00` : null,
      })
      toast(`v${published.version} 게시 완료`)
      setEffectiveAt('')
      loadSummaries()
      fetchAdminPolicyVersions(selected).then(setVersions)
    } catch {
      toast('게시에 실패했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setPublishing(false)
    }
  }

  const selectedSummary = summaries.find((s) => s.slug === selected) ?? null

  return (
    <>
      <h2 className="section-title" style={{ marginBottom: 4 }}>정책 관리</h2>
      <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 20 }}>
        법적 고지문은 수정 대신 항상 새 버전으로 게시돼요. 시행일을 미래로 잡으면 그때부터 자동 전환돼요.
      </p>

      {/* 문서 선택 카드 — 종류별 현재 버전·시행일 */}
      <div className="grid-stats cols-3" style={{ marginBottom: 24 }}>
        {summaries.map((summary) => (
          <button
            key={summary.slug}
            type="button"
            onClick={() => select(summary.slug)}
            className={clsx('card', 'pol-card', selected === summary.slug && 'on')}
          >
            <span className="pol-card-name">{summary.displayName}</span>
            <span className="pol-card-ver num">
              {summary.currentVersion == null ? '미게시' : `v${summary.currentVersion}`}
            </span>
            <span className="pol-card-sub">
              {summary.currentVersion == null
                ? '아직 게시된 버전이 없어요'
                : `시행일 ${formatDateTime(summary.effectiveAt)}`}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* 에디터 카드 */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="pol-editor-head">
              <h3 className="pol-editor-title">
                {selectedSummary?.displayName}
                {versions.length > 0 && (
                  <span className="pol-next num"> · 게시 시 v{versions[0].version + 1}</span>
                )}
              </h3>
              <div className="seg">
                <button type="button" className={clsx(mode === 'edit' && 'on')} onClick={() => setMode('edit')}>
                  편집
                </button>
                <button type="button" className={clsx(mode === 'preview' && 'on')} onClick={() => setMode('preview')}>
                  미리보기
                </button>
              </div>
            </div>

            <div className="pol-fields">
              <div className="pol-field">
                <label>제목</label>
                <input
                  type="text"
                  placeholder="예: Pullit 이용약관"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="pol-field">
                <label>시행일 (비우면 즉시 시행)</label>
                <input
                  type="datetime-local"
                  placeholder="즉시 시행"
                  value={effectiveAt}
                  onChange={(e) => setEffectiveAt(e.target.value)}
                />
              </div>
            </div>

            {mode === 'edit' ? (
              <textarea
                className="pol-content"
                placeholder="마크다운으로 작성해주세요. 표는 GFM 문법(| 구분 |)을 지원해요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            ) : (
              <div className="pol-preview policy-doc">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            )}

            <div className="pol-actions">
              <button
                type="button"
                className="btn primary"
                onClick={publish}
                disabled={!title.trim() || !content.trim() || publishing}
              >
                {publishing ? '게시 중…' : '새 버전 게시'}
              </button>
            </div>
          </div>

          {/* 버전 이력 */}
          <div className="card">
            <h3 className="pol-editor-title" style={{ marginBottom: 12 }}>버전 이력</h3>
            {versions.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>아직 게시된 버전이 없어요.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>버전</th>
                      <th>제목</th>
                      <th style={{ width: 160 }}>시행일</th>
                      <th style={{ width: 160 }}>게시일</th>
                      <th style={{ width: 130 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((version) => (
                      <tr key={version.id}>
                        <td className="num">v{version.version}</td>
                        <td className="strong">{version.title}</td>
                        <td className="num">{formatDateTime(version.effectiveAt)}</td>
                        <td className="num">{formatDateTime(version.createdAt)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="btn sm" onClick={() => loadVersion(version)}>
                            에디터로
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
