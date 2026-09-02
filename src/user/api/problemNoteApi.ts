import axios from 'axios'
import { api } from '@/user/api/authApi'

/**
 * 필기 대상 — 문제당 파일 하나씩 (S3 users/{userId}/notes/{problemCode}/{target}.pnk)
 * - problem: 문제 본문 위
 * - explanation: 해설 위
 * - translation: 번역 위 — 영어는 해설/번역 탭이 둘 다 필기 대상 (탭 UI 는 기획 대기 · 2026-09-02)
 */
export type NoteTarget = 'problem' | 'explanation' | 'translation'

/**
 * 문제 필기(PNK1) 저장·조회 API — 백엔드 경유 (presigned 직접 업로드 안 함 · 플랜 2026-09-02).
 *
 * 계약 (백엔드 pullit-backend `problemnote/controller/ProblemNoteController` 가 1:1 구현 · 2026-09-02):
 *   GET /api/problem-notes/{problemId}/{target}
 *     200 application/octet-stream = 저장할 때 보낸 바이트 그대로. gzip 으로 올린 파일은 Content-Encoding: gzip 으로
 *     내려오고 브라우저가 자동으로 푼다 (여기 코드는 해제하지 않는다)
 *     404 = 저장된 필기 없음
 *   PUT /api/problem-notes/{problemId}/{target}
 *     본문 application/octet-stream · Content-Encoding: gzip — 서버는 풀지 않고 받은 그대로 S3 에 둔다
 *     (탭 종료 직전 keepalive 전송만 헤더 없이 원본 · 서버 검증은 크기 상한과 앞머리(매직)뿐이라 파일 정합은 여기 코덱 몫)
 *   problemId = Problem.serverId (problems.problem_code) · target = problem | explanation | translation
 *   CORS: PUT 은 preflight 대상 — 백엔드 allowedHeaders(*) 가 Content-Encoding 을 되돌려준다
 */
const noteUrl = (problemId: string, target: NoteTarget) =>
  `/api/problem-notes/${encodeURIComponent(problemId)}/${target}`

/** 저장본 조회 — 없으면(404·빈 본문) null · 그 외 실패는 throw (호출부가 "덮어쓰기 금지" 판단) */
export async function fetchProblemNote(
  problemId: string,
  target: NoteTarget,
): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const { data, status } = await api.get<ArrayBuffer>(noteUrl(problemId, target), {
      responseType: 'arraybuffer',
    })
    if (status === 204 || !data || data.byteLength === 0) return null
    return new Uint8Array(data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null
    throw error
  }
}

/** 저장 — gzip 본문이면 Content-Encoding: gzip, 압축 못 한(구형 브라우저) 원본이면 헤더 없이 */
export async function uploadProblemNote(
  problemId: string,
  target: NoteTarget,
  body: Uint8Array<ArrayBuffer>,
  encoding: 'gzip' | 'identity',
): Promise<void> {
  await api.put(noteUrl(problemId, target), new Blob([body]), {
    headers: {
      'Content-Type': 'application/octet-stream',
      ...(encoding === 'gzip' ? { 'Content-Encoding': 'gzip' } : {}),
    },
  })
}

/**
 * 탭 종료·백그라운드 전환 직전 저장 — fetch keepalive 는 페이지가 내려가도 전송된다.
 * 압축(CompressionStream)은 비동기라 이 시점엔 못 쓰므로 원본을 그대로 보낸다
 * (keepalive 본문 상한 64KB — 넘으면 브라우저가 거부하고 dirty 가 남아 다음 트리거에 재전송).
 */
export function uploadProblemNoteKeepalive(
  problemId: string,
  target: NoteTarget,
  raw: Uint8Array<ArrayBuffer>,
): Promise<void> {
  return fetch(`${api.defaults.baseURL ?? ''}${noteUrl(problemId, target)}`, {
    method: 'PUT',
    body: new Blob([raw]),
    headers: { 'Content-Type': 'application/octet-stream' },
    credentials: 'include',
    keepalive: true,
  }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })
}

/** gzip 압축 — CompressionStream 미지원 브라우저면 null (호출부가 원본 전송) */
export async function gzipBytes(
  bytes: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
