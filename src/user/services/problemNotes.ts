import { isAxiosError } from 'axios'
import {
  fetchProblemNote,
  gzipBytes,
  uploadProblemNote,
  uploadProblemNoteKeepalive,
  type NoteTarget,
} from '@/user/api/problemNoteApi'
import { deleteJournal, putJournal, readJournal } from '@/user/services/noteJournal'
import { useUserStore } from '@/user/stores/userStore'
import { decodePnk1, encodePnk1, Pnk1Error, type Pnk1Note } from '@/user/utils/pnk1'
import {
  newStrokeId,
  strokeRect,
  type NoteStroke,
  type NoteStrokeType,
} from '@/user/utils/noteStroke'

/**
 * 문제 필기 저장소 (2026-09-02 · 플랜 "풀잇 필기 저장 — PNK1 포맷 도입").
 *
 * 화면(ProblemNoteCanvas)은 획이 바뀔 때마다 최신 목록만 넘기고, 업로드는 트리거
 * (문제 넘김 · 화면 이탈 · 탭 숨김)에서만 나간다 — 그리는 중에는 올리지 않는다.
 *
 * 메모리 캐시가 세션 안의 진실원 — 같은 문제로 돌아오면 재조회 없이 즉시 복원되고,
 * 익명(가입 전 맛보기)이라 못 올린 필기도 세션이 생기는 순간 일괄 전송된다.
 *
 * 안 올라간 변경분은 로컬 저널(IndexedDB · noteJournal)에도 남긴다 — 획이 바뀌면 잠시 뒤 로컬 디스크에 쓰고
 * (서버 부담 없음), 업로드가 성공하면 지운다. 앱을 다시 열면 남은 항목을 메모리로 올려 세션이 확인되는 즉시
 * 전부 보낸다(restoreProblemNotes) — 새로고침 · 크래시 · 가입 리다이렉트 · 오프라인 이탈에서도 필기가 살아남는다.
 *
 * 덮어쓰기 금지: 서버 저장본을 확인(200/404)하지 못한 항목은 업로드하지 않는다 —
 * 조회 실패로 빈 캔버스가 뜬 상태에서 그린 걸 올리면 이전 필기가 지워진다.
 * 저장 시점에 재조회해 서버본 뒤에 로컬본을 이어 붙인 뒤 올린다.
 */

interface NoteEntry {
  problemCode: string
  target: NoteTarget
  /** PNK1 메타 id — 서버본이 있으면 그 id, 없으면 최초 발급 후 유지 */
  noteId: string
  strokes: NoteStroke[]
  /** 서버 저장본 확인 완료 (200 = 병합됨 · 404 = 없음) */
  loaded: boolean
  /** 서버에 안 올라간 로컬 변경 존재 */
  dirty: boolean
  /** 로컬 저널 쓰기 예약 (디바운스) */
  journalTimer: number | null
}

/** 획이 멈춘 뒤 이만큼 지나면 저널에 쓴다 — 연속 획을 한 번에 */
const JOURNAL_DEBOUNCE_MS = 500
/** 이보다 오래 못 올린 저널 항목은 버린다 — 가입 안 한 게스트가 남긴 것이 무한히 쌓이지 않게 */
const JOURNAL_TTL_MS = 30 * 24 * 60 * 60 * 1000

const entries = new Map<string, NoteEntry>()
const loading = new Map<string, Promise<NoteStroke[]>>()
const saving = new Map<string, Promise<void>>()

const keyOf = (problemCode: string, target: NoteTarget) => `${problemCode}/${target}`

function entryOf(problemCode: string, target: NoteTarget): NoteEntry {
  const key = keyOf(problemCode, target)
  let entry = entries.get(key)
  if (!entry) {
    entry = {
      problemCode,
      target,
      noteId: newStrokeId(),
      strokes: [],
      loaded: false,
      dirty: false,
      journalTimer: null,
    }
    entries.set(key, entry)
  }
  return entry
}

/** 캐시 동기 조회 — 화면이 마운트 즉시 그린다. loaded=false 면 loadProblemNote 로 서버 확인 */
export function peekProblemNote(
  problemCode: string,
  target: NoteTarget,
): { strokes: NoteStroke[]; loaded: boolean } {
  const entry = entryOf(problemCode, target)
  return { strokes: entry.strokes, loaded: entry.loaded }
}

/**
 * 서버 저장본 확인 — 성공하면 (서버본 + 그새 그린 로컬본)으로 캐시를 채운다.
 * 익명이면 서버 조회 없이 캐시만 (401 왕복 소음 방지 · 세션이 생기면 flush 가 병합 처리).
 * 실패해도 throw 하지 않는다 — 캐시(loaded=false)를 돌려주고 저장 시점에 재시도.
 */
export function loadProblemNote(problemCode: string, target: NoteTarget): Promise<NoteStroke[]> {
  const entry = entryOf(problemCode, target)
  if (entry.loaded || !useUserStore.getState().me) return Promise.resolve(entry.strokes)
  const key = keyOf(problemCode, target)
  const pending = loading.get(key)
  if (pending) return pending

  const promise = (async () => {
    try {
      const bytes = await fetchProblemNote(problemCode, target)
      if (bytes) {
        const note = decodePnk1(bytes)
        if (typeof note.id === 'string' && note.id) entry.noteId = note.id
        // 조회 중 그린 획(dirty)은 서버본 뒤에 이어 붙인다 — 어느 쪽도 버리지 않는다
        entry.strokes = fromPnk1(note).concat(entry.dirty ? entry.strokes : [])
      }
      entry.loaded = true
    } catch (error) {
      if (error instanceof Pnk1Error && error.kind === 'corrupt') {
        // 깨진 파일은 버려도 잃을 게 없다 — "없음"으로 보고 다음 저장이 덮어쓰게 한다.
        // (서버는 파일을 풀지 않아 내용을 검증하지 못한다 · 여기서 막으면 이 문제의 저장이 영원히 막힌다)
        entry.loaded = true
        console.warn('[problemNotes] corrupt note ignored', key, error)
      } else {
        // 네트워크 실패 · 미지원 버전(더 새 클라이언트의 파일) — loaded=false 유지 → 덮어쓰지 않는다
        console.warn('[problemNotes] load failed', key, error)
      }
    }
    return entry.strokes
  })().finally(() => loading.delete(key))
  loading.set(key, promise)
  return promise
}

/** 화면의 최신 획 목록 반영 — 네트워크 없음 (업로드는 flush 트리거에서 · 로컬 저널만 잠시 뒤 갱신) */
export function updateProblemNote(
  problemCode: string,
  target: NoteTarget,
  strokes: NoteStroke[],
): void {
  const entry = entryOf(problemCode, target)
  entry.strokes = strokes
  entry.dirty = true
  scheduleJournal(entry)
}

function scheduleJournal(entry: NoteEntry): void {
  if (entry.journalTimer != null) window.clearTimeout(entry.journalTimer)
  entry.journalTimer = window.setTimeout(() => {
    entry.journalTimer = null
    void writeJournal(entry)
  }, JOURNAL_DEBOUNCE_MS)
}

function writeJournal(entry: NoteEntry): Promise<void> {
  return putJournal({
    key: keyOf(entry.problemCode, entry.target),
    problemCode: entry.problemCode,
    target: entry.target,
    noteId: entry.noteId,
    pnk: encodePnk1(toPnk1(entry.noteId, entry.strokes)),
    updatedAt: Date.now(),
  })
}

/** 업로드 성공 — 예약된 저널 쓰기를 취소하고 저널에서 지운다 (그새 수정됐으면 호출부가 부르지 않는다) */
function clearJournal(entry: NoteEntry): void {
  if (entry.journalTimer != null) {
    window.clearTimeout(entry.journalTimer)
    entry.journalTimer = null
  }
  void deleteJournal(keyOf(entry.problemCode, entry.target))
}

/** 예약만 돼 있던 저널 쓰기를 지금 — 탭이 내려가기 직전 */
function flushJournalNow(): void {
  for (const entry of entries.values()) {
    if (entry.journalTimer == null) continue
    window.clearTimeout(entry.journalTimer)
    entry.journalTimer = null
    void writeJournal(entry)
  }
}

/**
 * 앱 시작 — 저널에 남은(못 올린) 필기를 메모리로 올리고 세션이 확인되는 즉시 전부 보낸다.
 * 그 문제를 다시 열 때까지 기다리지 않는다 — 안 열 수도 있고, 다른 기기에서 보려면 서버에 있어야 한다.
 * 메모리에 이미 같은 항목이 있으면(그 사이 그린 것) 저널본 뒤에 이어 붙인다.
 */
export async function restoreProblemNotes(): Promise<void> {
  const records = await readJournal()
  const now = Date.now()
  for (const record of records) {
    if (now - record.updatedAt > JOURNAL_TTL_MS) {
      void deleteJournal(record.key)
      continue
    }
    let strokes: NoteStroke[]
    try {
      strokes = fromPnk1(decodePnk1(record.pnk))
    } catch (error) {
      console.warn('[problemNotes] corrupt journal dropped', record.key, error)
      void deleteJournal(record.key)
      continue
    }
    const entry = entryOf(record.problemCode, record.target)
    entry.noteId = record.noteId
    entry.strokes = strokes.concat(entry.dirty ? entry.strokes : [])
    entry.dirty = true
  }
  if (records.length > 0) await flushAllProblemNotes()
}

/** 업로드 (변경분 있을 때만) — 문제 넘김·화면 이탈에서 호출. 실패분은 dirty 유지 → 다음 트리거에 재시도 */
export function flushProblemNote(problemCode: string, target: NoteTarget): Promise<void> {
  return flushEntry(entryOf(problemCode, target))
}

/** 세션 확보 직후 — 익명 상태에서 쌓인 변경분 일괄 전송 */
export function flushAllProblemNotes(): Promise<void> {
  return Promise.all([...entries.values()].map((entry) => flushEntry(entry))).then(() => undefined)
}

async function flushEntry(entry: NoteEntry): Promise<void> {
  if (!entry.dirty || !useUserStore.getState().me) return
  if (!entry.loaded) {
    await loadProblemNote(entry.problemCode, entry.target)
    if (!entry.loaded) return // 서버본 확인 실패 — 덮어쓰지 않고 다음 기회에
  }
  const key = keyOf(entry.problemCode, entry.target)
  // 같은 키의 업로드는 순서대로 — 앞선 요청이 늦게 도착해 최신본을 덮는 역전 방지
  const run = (saving.get(key) ?? Promise.resolve()).then(async () => {
    const strokes = entry.strokes
    entry.dirty = false
    try {
      const raw = encodePnk1(toPnk1(entry.noteId, strokes))
      const gz = await gzipBytes(raw)
      await uploadProblemNote(entry.problemCode, entry.target, gz ?? raw, gz ? 'gzip' : 'identity')
      if (entry.strokes === strokes) clearJournal(entry)
    } catch (error) {
      // 다시 보내도 같은 답인 실패(서버 미매핑 문항 404 · 형식 400 등)는 버린다 — 트리거마다 재시도하면 소음만 남는다.
      // 네트워크 단절·5xx·401(재발급 후 재시도)·429 는 dirty 유지 → 다음 트리거에 재시도
      if (entry.strokes === strokes && isRetryableUploadError(error)) entry.dirty = true
      console.warn('[problemNotes] upload failed', key, error)
    }
  })
  saving.set(key, run)
  await run
  if (saving.get(key) === run) saving.delete(key)
}

/** 재시도 가치가 있는 실패인가 — attemptQueue.isRetryableAttemptError 와 같은 기준 */
function isRetryableUploadError(error: unknown): boolean {
  if (!isAxiosError(error)) return true // 네트워크 레벨 실패
  const status = error.response?.status
  if (status == null) return true
  return status >= 500 || status === 401 || status === 429
}

/**
 * 탭 종료·백그라운드 직전 — 동기 keepalive 전송 (압축 없음).
 * 성공 확인 전엔 dirty 를 내리지 않는다 → 페이지가 살아 돌아오면 다음 트리거가 다시 보낸다 (멱등 PUT).
 */
function flushKeepalive(): void {
  if (!useUserStore.getState().me) return
  for (const entry of entries.values()) {
    if (!entry.dirty || !entry.loaded) continue
    const strokes = entry.strokes
    uploadProblemNoteKeepalive(entry.problemCode, entry.target, encodePnk1(toPnk1(entry.noteId, strokes)))
      .then(() => {
        if (entry.strokes === strokes) {
          entry.dirty = false
          clearJournal(entry)
        }
      })
      .catch(() => {})
  }
}

if (typeof window !== 'undefined') {
  // 내려가기 직전 — 예약된 저널 쓰기부터 밀어 넣고(keepalive 가 실패해도 다음 시작에 올라가게) keepalive 전송
  const onLeave = () => {
    flushJournalNow()
    flushKeepalive()
  }
  window.addEventListener('pagehide', onLeave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onLeave()
  })
  // 게스트 발급·로그인으로 세션이 생기는 순간 — 익명 상태에서 쌓인 필기를 올린다
  useUserStore.subscribe((state, prev) => {
    if (state.me && !prev.me) void flushAllProblemNotes()
  })
}

// ---------------------------------------------------------------------------
// NoteStroke ↔ PNK1
// ---------------------------------------------------------------------------

/** 형광펜 알파 — DrawingCanvas 렌더(0.32)와 같은 값. 패스노트 marker 색이 #RRGGBBAA 라 색에 실어 저장 */
const MARKER_ALPHA = '52'
const MONO_ALPHA = 'FF'
/** 손상된 메타 폴백 — 툴바 기본 펜(0.35 × 14)·기본 색 */
const FALLBACK_WIDTH = 4.9
const FALLBACK_COLOR = '#120C0B'

function toPnk1(noteId: string, strokes: readonly NoteStroke[]): Pnk1Note {
  return {
    id: noteId,
    // 좌상단 원점 · y 아래로 증가 — 패스노트(좌하단 · y-up)와 반대라는 표식 (플랜 확정 규약)
    origin: 'top-left',
    images: [],
    texts: [],
    strokes: strokes.map((s) => ({
      id: s.id,
      type: s.type,
      color: s.color + (s.type === 'marker' ? MARKER_ALPHA : MONO_ALPHA),
      width: s.width,
      rect: s.rect,
      // 점은 16B 고정 — 압력 미사용(균일 굵기)이라 force 1.0 · altitude 0 으로 채운다
      points: s.points.map(([x, y]) => ({ x, y, force: 1, altitude: 0 })),
    })),
  }
}

function fromPnk1(note: Pnk1Note): NoteStroke[] {
  const out: NoteStroke[] = []
  for (const s of note.strokes) {
    if (s.points.length === 0) continue
    const points = s.points.map((p) => [p.x, p.y])
    // 미지 type 은 mono 폴백 — 패스노트 디코더와 같은 엣지 규약
    const type: NoteStrokeType = s.type === 'marker' ? 'marker' : 'mono'
    const width = typeof s.width === 'number' && s.width > 0 ? s.width : FALLBACK_WIDTH
    out.push({
      id: typeof s.id === 'string' && s.id ? s.id : newStrokeId(),
      type,
      color: parseRgb(s.color) ?? FALLBACK_COLOR,
      width,
      rect: isRect(s.rect) ? s.rect : strokeRect(points, width),
      points,
    })
  }
  return out
}

/** #RRGGBB · #RRGGBBAA → #RRGGBB (알파는 도구가 정한다 — 렌더 규칙과 동일) */
function parseRgb(color: unknown): string | null {
  if (typeof color !== 'string') return null
  const m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(color)
  return m ? `#${m[1].toUpperCase()}` : null
}

const isRect = (v: unknown): v is [number, number, number, number] =>
  Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
