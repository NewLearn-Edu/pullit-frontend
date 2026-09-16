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
 * - "학교가 없어요? 기타" 는 검색 중(2글자 이상)에만 결과 아래에 보인다 — 처음부터 칩을 깔지 않는다 (2026-09-16)
 * - 선택 카드(학교·기타)는 값이 찬 다른 인풋과 같은 회색 보더(#a6abb1)
 * grade 가 있으면 그 학교급만 (가입 화면에서 학년으로 좁힌다)
 */
export function SchoolPicker({
  grade,
  value,
  onChange,
  noneOptions = ['OTHER'],
  autoFocus = false,
  currentLabel,
}: {
  grade?: SchoolGrade | null
  value: SchoolChoice | null
  onChange: (choice: SchoolChoice | null) => void
  noneOptions?: SchoolNoneReason[]
  autoFocus?: boolean
  /** value 가 없을 때 인풋에 보여줄 현재 값 — 프로필 편집처럼 서버에 이미 저장된 학교명 (2026-09-16) */
  currentLabel?: string | null
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
  const selectedNone = !selected && value?.noneReason ? value.noneReason : null
  // 인풋 하나로 동작한다 (2026-09-16): 평소엔 고른 학교명(또는 "기타")을 값으로 보여주고,
  // 누르면(포커스) 검색 모드 — 이름이 전부 선택돼 바로 덮어쓸 수 있다. 결과에서 고르거나 밖을 누르면 검색 모드가 닫힌다
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedLabel = selected ? selected.name : selectedNone ? SCHOOL_NONE_LABEL[selectedNone] : (currentLabel ?? '')
  const shownValue = editing ? query : selectedLabel
  const searching = editing && query.trim().length >= 2
  const finish = (choice: SchoolChoice | null) => {
    if (choice) onChange(choice)
    setEditing(false)
    setQuery('')
    setResults([])
    setState('idle')
    inputRef.current?.blur()
  }

  return (
    <div className="flex w-full flex-col gap-[10px]">
      {/* 인풋 + (검색 중) 결과가 한 상자 — 결과 행들 맨 끝에 "학교가 없어요" 행 */}
      <div
        className={clsx(
          'w-full overflow-hidden rounded-[12px] border bg-white transition-colors duration-150',
          shownValue ? 'border-[#a6abb1]' : 'border-[#ebedf0] focus-within:border-[#a6abb1]',
        )}
      >
        <div className="flex h-[56px] items-center pl-[16px] pr-[16px]">
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            autoComplete="off"
            autoFocus={autoFocus}
            value={shownValue}
            onFocus={() => {
              setEditing(true)
              setQuery(selectedLabel)
              // 고른 학교명이 채워진 채 전부 선택 — 바로 타이핑하면 덮어써진다
              window.setTimeout(() => inputRef.current?.select(), 0)
            }}
            onBlur={() => {
              // 결과 클릭은 onMouseDown 이 blur 를 막아 여기 안 온다. 그냥 나가면 원래 값으로
              setEditing(false)
              setQuery('')
              setResults([])
              setState('idle')
            }}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="학교 이름을 검색해줘 (예: 대원외고)"
            aria-label="학교 검색"
            className={clsx(
              'min-w-0 flex-1 bg-transparent text-[16px] text-[#121417] outline-none placeholder:text-[#a6abb1]',
              editing ? 'cursor-text' : 'cursor-pointer', // 평소엔 셀렉트처럼 — 누르면 검색이 열린다는 신호
            )}
          />
        </div>
        {searching && (
          <ul role="listbox" aria-label="학교 검색 결과" className="max-h-[300px] overflow-y-auto border-t border-[#ebedf0] py-[4px]">
            {state === 'loading' && <li className="px-[16px] py-[10px] text-[13px] text-[#80858b]">찾는 중…</li>}
            {state === 'error' && <li className="px-[16px] py-[10px] text-[13px] text-[#ff385c]">검색에 실패했어. 잠시 후 다시 해줘</li>}
            {state === 'done' && results.length === 0 && (
              <li className="px-[16px] py-[10px] text-[13px] text-[#80858b]">검색 결과가 없어. 학교 이름을 다시 확인해줘</li>
            )}
            {results.map((s) => (
              <li
                key={s.id}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()} // 인풋 blur 보다 먼저 선택되게
                onClick={() => finish({ school: s })}
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
            {/* 학교 없음 — 결과 맨 아래 행. 선택하면 검색 대신 사유가 값이 된다 */}
            {state !== 'loading' &&
              noneOptions.map((r) => (
                <li
                  key={r}
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => finish({ noneReason: r })}
                  className="flex h-[48px] cursor-pointer items-center border-t border-[#ebedf0] pl-[58px] pr-[16px] text-[14px] text-[#5e6368] hover:bg-[#f7f8f9]" /* 왼쪽 58 = 패딩 14 + 배지 32 + 간격 12 → 학교명 텍스트와 세로 정렬 */
                >
                  찾는 학교가 없어요 - {SCHOOL_NONE_LABEL[r]}
                </li>
              ))}
          </ul>
        )}
      </div>

    </div>
  )
}
