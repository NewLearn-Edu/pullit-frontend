import { useCallback, useEffect, useRef, useState } from 'react'
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

/** 에디터가 열린 이유 — 이력 로우 클릭(수정) 또는 새로 등록. 닫혀 있으면 null */
type EditorState = { kind: 'edit'; version: PolicyVersion } | { kind: 'new' } | null

/**
 * 정책 관리 — 법적 고지문(이용약관·개인정보 처리방침·마케팅 수신동의) 게시.
 *
 * 문서 카드 선택 → 버전 이력이 먼저 보이고, 로우 클릭(수정) 또는
 * "새로 등록하기"로 에디터가 열린다. 법적 증빙을 위해 저장은 항상 새 버전
 * INSERT 이고, 시행일을 미래로 잡으면 그 시각부터 학생 화면이 자동 전환된다.
 */
export default function PoliciesPage() {
  const toast = useToast()

  const [summaries, setSummaries] = useState<PolicySummary[]>([])
  const [selected, setSelected] = useState<PolicySlug | null>(null)
  const [versions, setVersions] = useState<PolicyVersion[]>([])
  // 응답 전엔 빈 상태 문구를 그리지 않는다 — 빈 화면→데이터 깜빡임 방지
  const [versionsLoading, setVersionsLoading] = useState(false)
  // 한 번 불러온 문서는 캐시 — 카드 재클릭 시 즉시 그리고 뒤에서 최신화만
  const versionsCache = useRef<Partial<Record<PolicySlug, PolicyVersion[]>>>({})
  const [editor, setEditor] = useState<EditorState>(null)

  // 에디터 입력값
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

  const selectedSummary = summaries.find((s) => s.slug === selected) ?? null

  /** 문서 카드 선택 — 버전 이력만 보여주고 에디터는 닫아둔다 */
  const select = (slug: PolicySlug) => {
    setSelected(slug)
    setEditor(null)
    const cached = versionsCache.current[slug]
    setVersions(cached ?? [])
    setVersionsLoading(!cached)
    fetchAdminPolicyVersions(slug)
      .then((list) => {
        versionsCache.current[slug] = list
        setVersions(list)
        setVersionsLoading(false)
      })
      .catch(() => {
        setVersionsLoading(false)
        toast('버전 이력을 불러오지 못했어요')
      })
  }

  /** 이력 로우 클릭 — 그 버전 내용으로 에디터를 연다 (수정 흐름) */
  const openEdit = (version: PolicyVersion) => {
    setEditor({ kind: 'edit', version })
    setTitle(version.title)
    setContent(version.content)
    // 그 버전의 시행일 프리필 — ISO("2025-09-01T00:00:00") → datetime-local("2025-09-01T00:00")
    setEffectiveAt(version.effectiveAt ? version.effectiveAt.slice(0, 16) : '')
    setMode('edit')
  }

  /** 새로 등록하기 — 기본 제목만 채운 빈 에디터 */
  const openNew = () => {
    setEditor({ kind: 'new' })
    setTitle(selectedSummary ? `Pullit ${selectedSummary.displayName}` : '')
    setContent('')
    setEffectiveAt('')
    setMode('edit')
  }

  const closeEditor = () => setEditor(null)

  const publish = async () => {
    if (!selected || !editor || !title.trim() || !content.trim() || publishing) return
    const isEdit = editor.kind === 'edit'
    const effectiveLabel = effectiveAt ? `${effectiveAt.replace('T', ' ')} 시행` : '즉시 시행'
    // 이미 시행 중인 문서를 바꾸는 건 수정이든 새 등록이든 법적 무게가 같다 — 첫 게시만 가볍게
    const question =
      versions.length > 0
        ? `이미 시행 중인 정책을 ${isEdit ? '수정' : '변경'}하는 경우 법적 문제가 있을 수 있어요.\n팀원들과 진지하게 상의 후 진행해주세요.\n\n${isEdit ? '수정' : '등록'}하시겠어요? (${effectiveLabel} · 이전 내용은 버전 이력에 남아요)`
        : `등록할까요? (${effectiveLabel})`
    if (!window.confirm(question)) return

    setPublishing(true)
    try {
      const published = await publishAdminPolicy(selected, {
        title: title.trim(),
        content,
        effectiveAt: effectiveAt ? `${effectiveAt}:00` : null,
      })
      toast(isEdit ? `수정 완료 (v${published.version})` : `등록 완료 (v${published.version})`)
      setEditor(null)
      loadSummaries()
      fetchAdminPolicyVersions(selected).then((list) => {
        versionsCache.current[selected] = list
        setVersions(list)
      })
    } catch {
      toast('저장에 실패했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setPublishing(false)
    }
  }

  const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1

  return (
    <>
      <h2 className="section-title" style={{ marginBottom: 4 }}>정책 관리</h2>
      <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 20 }}>
        수정하면 이전 내용은 버전 이력에 남아요. 시행일을 미래로 잡으면 그때부터 자동 반영돼요.
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
              {summary.currentVersion != null
                ? `v${summary.currentVersion}`
                : summary.totalVersions > 0
                  ? '시행 대기'
                  : '미게시'}
            </span>
            <span className="pol-card-sub">
              {summary.currentVersion != null
                ? `시행일 ${formatDateTime(summary.effectiveAt)}`
                : summary.totalVersions > 0
                  ? '게시됐지만 시행일이 되지 않아 아직 노출 전이에요'
                  : '아직 게시된 버전이 없어요'}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* 에디터 — 이력 로우 클릭(수정) 또는 새로 등록하기로만 열린다 */}
          {editor && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="pol-editor-head">
                <h3 className="pol-editor-title">
                  {selectedSummary?.displayName}
                  <span className="pol-next num">
                    {editor.kind === 'edit'
                      ? ` · v${editor.version.version} 수정 → v${nextVersion} 로 기록`
                      : versions.length > 0
                        ? ` · 새로 등록 → v${nextVersion} 로 기록`
                        : ' · 첫 등록'}
                  </span>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="seg">
                    <button type="button" className={clsx(mode === 'edit' && 'on')} onClick={() => setMode('edit')}>
                      편집
                    </button>
                    <button type="button" className={clsx(mode === 'preview' && 'on')} onClick={() => setMode('preview')}>
                      미리보기
                    </button>
                  </div>
                  <button type="button" className="pol-close" onClick={closeEditor} aria-label="에디터 닫기">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
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
                <button type="button" className="btn btn-ghost" onClick={closeEditor} disabled={publishing}>
                  닫기
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={publish}
                  disabled={!title.trim() || !content.trim() || publishing}
                >
                  {publishing
                    ? editor.kind === 'edit'
                      ? '수정 중…'
                      : '등록 중…'
                    : editor.kind === 'edit'
                      ? '수정하기'
                      : '등록하기'}
                </button>
              </div>
            </div>
          )}

          {/* 버전 이력 — 로우 클릭으로 해당 버전을 수정 */}
          <div className="card">
            <div className="pol-editor-head" style={{ marginBottom: 12 }}>
              <h3 className="pol-editor-title">버전 이력</h3>
              {/* 에디터가 열려 있으면 숨김 — 에디터의 수정하기와 primary 버튼이 나란히 붙어 헷갈린다 */}
              {!editor && (
                <button type="button" className="btn btn-primary" onClick={openNew}>
                  새로 등록하기
                </button>
              )}
            </div>
            {versionsLoading && versions.length === 0 ? (
              /* 응답 전 스켈레톤 — "없어요" 문구가 스치는 깜빡임 방지 */
              <div className="pol-skeleton">
                <span />
                <span />
              </div>
            ) : versions.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                아직 등록된 버전이 없어요. 새로 등록하기로 첫 버전을 작성해주세요.
              </p>
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
                      <tr
                        key={version.id}
                        className={clsx(
                          'pol-row',
                          editor?.kind === 'edit' && editor.version.id === version.id && 'on',
                        )}
                        onClick={() => openEdit(version)}
                      >
                        <td className="num">v{version.version}</td>
                        <td className="strong">{version.title}</td>
                        <td className="num">{formatDateTime(version.effectiveAt)}</td>
                        <td className="num">{formatDateTime(version.createdAt)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-muted)', fontSize: 13 }}>
                          수정하기
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
