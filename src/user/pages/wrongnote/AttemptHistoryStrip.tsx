import { StudyMark } from '@/user/components/RecentStudyCard'
import { choiceMark } from '@/shared/components/ExamRender'
import type { AttemptHistoryItem } from '@/user/api/attemptApi'

/**
 * 풀이 이력 띠 — 이 문제를 회차별로 무엇을 골라 맞았는지 (2026-09-06).
 *
 * 홈 "최근 학습"(RecentStudyCard) 하단 띠와 같은 배경·구분선·마크를 쓴다. 거기선 칼럼이 세트의
 * 문항(1번·2번·3번)이고 여기선 같은 문제를 푼 회차(1회·2회·…). 왼쪽이 첫 풀이.
 *
 * 칼럼은 세 줄 — 회차 / 내가 고른 답 / ○✕. 답과 정답 여부를 한 글리프에 겹쳐 담아 봤지만
 * 작은 크기에서 안 읽힌다(채운 원문자 ❶❷ 는 18px 에서도 뭉갠다) — 각자 한 줄씩 준다.
 * 답은 빈 원문자 ①~⑤ — 시험 지면에서 "보기 번호"를 뜻하는 표기라 회차 숫자와 헷갈리지 않는다.
 * 정답 여부를 말하는 건 아래 마크 하나뿐이고, 답 글자는 색으로 아무것도 주장하지 않는다.
 */
export function AttemptHistoryStrip({
  attempts,
  limit = 5,
}: {
  attempts: AttemptHistoryItem[]
  /** 한 줄에 보일 최대 회차 — 넘으면 최근 것만 남기고 접힌 수를 맨 앞에 알린다 */
  limit?: number
}) {
  if (attempts.length === 0) return null

  const hidden = Math.max(0, attempts.length - limit)
  const shown = hidden > 0 ? attempts.slice(-limit) : attempts

  return (
    <div
      className="flex w-full items-center border-t border-[#e5e7ea] bg-[#f8f8f8] p-[12px]"
      aria-label={`풀이 이력 ${attempts.length}회`}
    >
      {hidden > 0 && (
        <span className="flex min-w-0 flex-1 flex-col items-center gap-[6px] px-[2px]">
          <span className="whitespace-nowrap text-[12px] font-semibold text-[#c3c7cc]">이전</span>
          <span className="text-[20px] font-semibold leading-[1.1] text-[#c3c7cc]">+{hidden}</span>
        </span>
      )}
      {shown.map((attempt, i) => {
        // 접힌 앞부분을 건너뛰어도 회차는 실제 순번 그대로 (5회를 3회로 보이게 하지 않는다)
        const round = hidden + i + 1
        return (
          <span key={attempt.attemptId} className="flex min-w-0 flex-1 items-center">
            {(i > 0 || hidden > 0) && (
              <span className="h-[44px] w-px shrink-0 bg-[#e5e7ea]" aria-hidden />
            )}
            <span
              title={`${round}회 · ${formatFullDate(attempt.attemptedAt)}`}
              className="flex min-w-0 flex-1 flex-col items-center gap-[6px] px-[2px]"
            >
              <span className="whitespace-nowrap text-[12px] font-semibold text-[#80858b]">
                {round}회
              </span>
              <span
                className={
                  attempt.skipped
                    ? 'max-w-full truncate text-[12px] leading-[1.6] text-[#a6abb1]'
                    : 'max-w-full truncate text-[20px] font-semibold leading-[1.1] text-[#40464c]'
                }
              >
                {answerGlyph(attempt)}
              </span>
              <StudyMark kind={attempt.correct ? 'circle' : 'x'} />
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** 내가 낸 답 — 객관식은 보기 번호 ①~⑤, 단답형은 값, 무응답("모르겠어요")은 줄표 */
function answerGlyph(attempt: AttemptHistoryItem): string {
  if (attempt.skipped) return '—'
  if (attempt.submittedNo != null) return choiceMark(attempt.submittedNo)
  return attempt.submittedText?.trim() || '—'
}

/** hover 로 보는 정확한 시각 — "2026.09.05 08:30" */
function formatFullDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "3회에 정답" · 아직이면 "아직 정답 없음" — 띠 옆 한 줄 요약 */
export function historySummary(attempts: AttemptHistoryItem[]): string {
  const solvedAt = attempts.findIndex((a) => a.correct)
  return solvedAt >= 0 ? `${solvedAt + 1}회에 정답` : '아직 정답 없음'
}
