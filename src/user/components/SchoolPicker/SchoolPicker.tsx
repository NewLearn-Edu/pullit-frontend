import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  HIGH_TYPE_LABEL,
  SCHOOL_NONE_LABEL,
  searchSchools,
  type School,
  type SchoolGrade,
  type SchoolNoneReason,
} from '@/user/api/schoolApi'

/** 학교 선택 결과 — 학교 하나 또는 "학교 없음" 사유 하나 */
export type SchoolChoice = { school: School; noneReason?: undefined } | { school?: undefined; noneReason: SchoolNoneReason }

export function choiceLabel(choice: SchoolChoice | null): string {
  if (!choice) return ''
  return choice.school ? choice.school.name : SCHOOL_NONE_LABEL[choice.noneReason]
}

/** 학교명 첫 글자 원형 배지 — 로고가 없어(NEIS 미제공) 이걸로 통일 */
export function SchoolInitial({ initial, size = 36 }: { initial: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-[#eef1f4] font-bold text-[#23272b]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  )
}

const SEARCH_DEBOUNCE_MS = 250

/**
 * 학교 검색 + 선택 (2026-09-14 · AI-314). 가입 화면·프로필 편집·홈 팝업이 같이 쓴다.
 * - 입력이 멎고 250ms 뒤 검색 · 2글자 미만은 조회하지 않는다 (동명 학교가 많아 1글자는 노이즈)
 * - 결과는 이름 + 시도·주소 (동명 학교 구분) + 첫 글자 배지
 * - 아래 "학교가 없어요" 칩: N수생 / 검정고시 / 해외 / 해당 없음
 * grade 가 있으면 그 학교급만 (가입 화면에서 학년으로 좁힌다)
 */
export function SchoolPicker({
  grade,
  value,
  onChange,
  noneOptions = ['RETAKE', 'GED', 'OVERSEAS', 'OTHER'],
  autoFocus = false,
}: {
  grade?: SchoolGrade | null
  value: SchoolChoice | null
  onChange: (choice: SchoolChoice | null) => void
  noneOptions?: SchoolNoneReason[]
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<School[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const requestSeq = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setState('idle')
      return
    }
    const seq = ++requestSeq.current
    setState('loading')
    const t = window.setTimeout(() => {
      searchSchools(q, grade)
        .then((list) => {
          if (seq !== requestSeq.current) return
          setResults(list)
          setState('done')
        })
        .catch(() => {
          if (seq !== requestSeq.current) return
          setResults([])
          setState('error')
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query, grade])

  const selected = value?.school ?? null

  return (
    <div className="flex w-full flex-col gap-[10px]">
      {selected ? (
        <div className="flex h-[56px] items-center gap-[12px] rounded-[12px] border border-[#23272b] bg-white px-[14px]">
          <SchoolInitial initial={selected.initial} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-[#121417]">{selected.name}</p>
            <p className="truncate text-[12px] text-[#80858b]">
              {[selected.region, selected.address].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setQuery('')
            }}
            className="shrink-0 text-[13px] font-semibold text-[#5e6368]"
          >
            변경
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="학교 이름을 검색해줘 (예: 대원외고)"
            aria-label="학교 검색"
            className={clsx(
              'h-[56px] w-full rounded-[12px] border bg-white px-[16px] text-[16px] text-[#121417] outline-none transition-colors duration-150 placeholder:text-[#a6abb1]',
              query ? 'border-[#a6abb1]' : 'border-[#ebedf0] focus:border-[#a6abb1]',
            )}
          />
          {state === 'loading' && <p className="px-[4px] text-[13px] text-[#80858b]">찾는 중…</p>}
          {state === 'error' && <p className="px-[4px] text-[13px] text-[#ff385c]">검색에 실패했어. 잠시 후 다시 해줘</p>}
          {state === 'done' && results.length === 0 && (
            <p className="px-[4px] text-[13px] text-[#80858b]">검색 결과가 없어. 학교 이름을 다시 확인해줘</p>
          )}
          {results.length > 0 && (
            <ul role="listbox" aria-label="학교 검색 결과" className="max-h-[264px] overflow-y-auto rounded-[12px] border border-[#e5e7ea] bg-white py-[4px]">
              {results.map((s) => (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onChange({ school: s })
                    setQuery('')
                    setResults([])
                    setState('idle')
                  }}
                  className="flex cursor-pointer items-center gap-[12px] px-[14px] py-[10px] hover:bg-[#f7f8f9]"
                >
                  <SchoolInitial initial={s.initial} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[#121417]">
                      {s.name}
                      {s.highType && HIGH_TYPE_LABEL[s.highType] && (
                        <span className="ml-[6px] text-[12px] font-medium text-[#80858b]">{HIGH_TYPE_LABEL[s.highType]}</span>
                      )}
                    </p>
                    <p className="truncate text-[12px] text-[#80858b]">{[s.region, s.address].filter(Boolean).join(' · ')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* 학교 없음 — 사유 칩. 선택하면 검색 대신 사유가 값이 된다 */}
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="text-[13px] text-[#80858b]">학교가 없어요:</span>
        {noneOptions.map((r) => {
          const on = value?.noneReason === r
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : { noneReason: r })}
              className={clsx(
                'h-[36px] rounded-[10px] border px-[12px] text-[13px] font-semibold transition-colors duration-150',
                on ? 'border-[#23272b] bg-[#23272b] text-white' : 'border-[#ebedf0] bg-white text-[#23272b] hover:bg-[#f7f8f9]',
              )}
            >
              {SCHOOL_NONE_LABEL[r]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
