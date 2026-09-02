import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  fetchAdminUnitAverages,
  updateAdminUnitAverageSeed,
  type AdminUnitAverage,
} from '../api/adminApi'
import { useToast } from '../components/toast'

type SubjectKey = 'MATH' | 'ENGLISH'

/**
 * 평균 관리 — 유저 리포트 "평균 점수 비교"에 노출되는 소단원별 풀잇 평균.
 *
 * 실제 평균(유저별 최신 진단 실측)은 읽기 전용으로 보여주고,
 * 노출 평균(시드)만 여기서 수정한다. 표본이 minSample 이상 모인 단원은
 * 시드 대신 실측이 자동 노출된다(REAL) — 그때부터 시드는 예비값.
 */
export default function UnitAveragesPage() {
  const toast = useToast()

  const [subject, setSubject] = useState<SubjectKey>('MATH')
  const [rows, setRows] = useState<AdminUnitAverage[]>([])
  const [loading, setLoading] = useState(true)
  // unitCode → 입력 중인 시드값 문자열 (서버값과 같으면 키 제거)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(
    (target: SubjectKey) => {
      setLoading(true)
      fetchAdminUnitAverages(target)
        .then((list) => {
          setRows(list)
          setDrafts({})
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
          toast('평균 목록을 불러오지 못했어요')
        })
    },
    [toast],
  )

  useEffect(() => {
    load(subject)
  }, [subject, load])

  const editDraft = (unitCode: string, value: string, serverSeed: number) => {
    setDrafts((prev) => {
      const next = { ...prev }
      if (value === String(serverSeed)) delete next[unitCode]
      else next[unitCode] = value
      return next
    })
  }

  const save = async (row: AdminUnitAverage) => {
    const raw = drafts[row.unitCode]
    const value = Number(raw)
    if (raw === undefined || !Number.isInteger(value) || value < 0 || value > 100) {
      toast('0~100 사이 정수로 입력해주세요')
      return
    }
    setSaving(row.unitCode)
    try {
      await updateAdminUnitAverageSeed(row.unitCode, value)
      setRows((prev) =>
        prev.map((r) =>
          r.unitCode === row.unitCode
            ? {
                ...r,
                seedScore: value,
                exposedScore: r.source === 'SEED' ? value : r.exposedScore,
              }
            : r,
        ),
      )
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[row.unitCode]
        return next
      })
      toast(`${row.skillNode} 노출 평균을 ${value}점으로 저장했어요`)
    } catch {
      toast('저장에 실패했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setSaving(null)
    }
  }

  const minSample = rows[0]?.minSample ?? 30

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 className="section-title" style={{ marginBottom: 4 }}>평균 관리</h2>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
            리포트 평균 점수 비교에 나가는 풀잇 평균이에요. 진단 표본이 {minSample}명 미만인
            단원은 노출 평균(시드)이 나가고, 그 이상 모이면 실제 평균으로 자동 전환돼요.
          </p>
        </div>
        <div className="seg">
          <button type="button" className={clsx(subject === 'MATH' && 'on')} onClick={() => setSubject('MATH')}>
            수학
          </button>
          <button
            type="button"
            className={clsx(subject === 'ENGLISH' && 'on')}
            onClick={() => setSubject('ENGLISH')}
          >
            영어
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>불러오는 중…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>단원</th>
                  <th style={{ width: 130 }}>실제 평균</th>
                  <th style={{ width: 90 }}>표본</th>
                  <th style={{ width: 170 }}>노출 평균 (시드)</th>
                  <th style={{ width: 110 }}>노출 중</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const draft = drafts[row.unitCode]
                  const dirty = draft !== undefined
                  return (
                    <tr key={row.unitCode}>
                      <td>
                        <span className="strong">{row.skillNode}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)' }}>
                          {row.unitLarge} · {row.unitCode}
                        </span>
                      </td>
                      <td className="num">
                        {row.realAverage != null ? `${row.realAverage}점` : '—'}
                      </td>
                      <td className="num">{row.userCount}명</td>
                      <td>
                        <input
                          type="number"
                          className="ua-seed-input num"
                          min={0}
                          max={100}
                          value={draft ?? String(row.seedScore)}
                          onChange={(e) => editDraft(row.unitCode, e.target.value, row.seedScore)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && dirty) save(row)
                          }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--color-muted)', marginLeft: 6 }}>점</span>
                      </td>
                      <td>
                        {row.source === 'REAL' ? (
                          <span className="badge live ua-badge-fit">실제 {row.exposedScore}점</span>
                        ) : (
                          <span className="badge neutral ua-badge-fit">시드 {row.exposedScore}점</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!dirty || saving === row.unitCode}
                          onClick={() => save(row)}
                        >
                          {saving === row.unitCode ? '저장 중…' : '저장'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
