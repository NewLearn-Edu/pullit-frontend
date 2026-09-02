import type { NoteTarget } from '@/user/api/problemNoteApi'

/**
 * 필기 로컬 저널 (IndexedDB) — 서버에 아직 안 올라간 필기를 브라우저 디스크에 남긴다 (2026-09-02).
 *
 * 메모리 캐시(problemNotes)는 문서가 내려가면 사라진다 — 새로고침 · 크래시 · 비로그인 중 가입 리다이렉트 ·
 * 오프라인 이탈에서 그리던 필기를 잃지 않으려면 로컬에 남겨 두고 다음 앱 시작 때 올려야 한다.
 * 서버 업로드 시점은 그대로다(획마다 올리지 않음) — 저널은 로컬 디스크라 서버 부담이 없다.
 * 항목은 서버 업로드가 성공하면 지운다. 남아 있는 건 "아직 못 올린 것"뿐이다.
 * 게스트는 서버에 올리지 않으므로 게스트의 필기는 회원이 될 때까지 여기 머문다.
 *
 * IndexedDB 가 없거나 막힌 환경(구형 사파리 프라이빗 모드 등)에선 조용히 no-op — 저널 없이 메모리만으로 동작한다.
 */
export interface NoteJournalRecord {
  /** `${userId}/${problemCode}/${target}` */
  key: string
  /** 소유자 — me.id 문자열, 세션 없이 그린 것은 'anonymous' (세션이 생기면 그 유저에게 넘긴다). 초기 저널엔 없었음 */
  userId?: string
  problemCode: string
  target: NoteTarget
  /** PNK1 메타 id — 재업로드 때도 같은 id 를 유지 */
  noteId: string
  /** PNK1 파일 바이트 — 메모리 캐시의 획 목록을 그대로 인코드한 것 */
  pnk: Uint8Array
  updatedAt: number
}

const DB_NAME = 'pullit-notes'
const DB_VERSION = 1
const STORE = 'journal'

let dbPromise: Promise<IDBDatabase | null> | null = null

/** DB 는 한 번만 연다. 못 열면 null — 이후 모든 호출이 no-op */
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        console.warn('[noteJournal] IndexedDB 열기 실패 — 저널 없이 진행', request.error)
        resolve(null)
      }
      request.onblocked = () => resolve(null)
    } catch (error) {
      console.warn('[noteJournal] IndexedDB 사용 불가 — 저널 없이 진행', error)
      resolve(null)
    }
  })
  return dbPromise
}

/** 트랜잭션 한 건 — 실패는 undefined 로 (저널은 최선 노력 · 필기 흐름을 막지 않는다) */
function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return openDb().then((db) => {
    if (!db) return undefined
    return new Promise<T | undefined>((resolve) => {
      try {
        const transaction = db.transaction(STORE, mode)
        const request = action(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(undefined)
        transaction.onabort = () => resolve(undefined)
      } catch {
        resolve(undefined)
      }
    })
  })
}

export async function putJournal(record: NoteJournalRecord): Promise<void> {
  await run('readwrite', (store) => store.put(record))
}

export async function deleteJournal(key: string): Promise<void> {
  await run('readwrite', (store) => store.delete(key))
}

export async function readJournal(): Promise<NoteJournalRecord[]> {
  return (await run('readonly', (store) => store.getAll() as IDBRequest<NoteJournalRecord[]>)) ?? []
}
