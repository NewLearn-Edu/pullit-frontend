import axios from 'axios'
import { api } from '@/user/api/authApi'

/**
 * 필기 대상 — 문제당 파일 하나씩 (S3 users/{userId}/notes/{problemCode}/{target}.pnk.gz)
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
 *     200 application/octet-stream + Content-Encoding: gzip = 저장할 때 보낸 바이트 그대로.
 *     브라우저가 헤더를 보고 자동으로 푼다 (여기 코드는 해제하지 않는다)
 *     404 = 저장된 필기 없음
 *   PUT /api/problem-notes/{problemId}/{target}
 *     본문 application/octet-stream · Content-Encoding: gzip — 서버는 풀지 않고 받은 그대로 S3(.pnk.gz)에 둔다
 *     (압축 API 가 없는 구형 브라우저는 원본으로 보내고 서버가 눌러서 맞춘다 · 서버 검증은 크기 상한과 앞머리뿐이라
 *     파일 정합은 여기 코덱 몫 · 탭 종료 직전 전송은 없다 — 로컬 저널이 다음 시작 때 올린다)
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

/** 저장 — gzip 본문이면 Content-Encoding: gzip, 압축 못 한(구형 브라우저) 원본이면 헤더 없이 (서버가 눌러서 보관) */
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

/** gzip 압축 — CompressionStream 미지원 브라우저면 null (호출부가 원본 전송) */
export async function gzipBytes(
  bytes: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
