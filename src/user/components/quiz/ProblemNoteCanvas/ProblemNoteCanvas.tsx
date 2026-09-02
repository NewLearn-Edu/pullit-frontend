import { forwardRef, useCallback, useEffect, useRef } from 'react'
import {
  DrawingCanvas,
  type DrawingCanvasHandle,
  type DrawingCanvasProps,
} from '@/user/components/quiz/DrawingCanvas'
import type { NoteTarget } from '@/user/api/problemNoteApi'
import {
  flushProblemNote,
  loadProblemNote,
  peekProblemNote,
  updateProblemNote,
} from '@/user/services/problemNotes'
import type { NoteStroke } from '@/user/utils/noteStroke'

interface ProblemNoteCanvasProps extends Omit<DrawingCanvasProps, 'onStrokesChange'> {
  /** 서버 문제 코드(Problem.serverId) — 없으면(서버 미매핑 목 문항) 저장·복원 없이 화면 안에서만 필기 */
  problemCode?: string
  /** 문제 본문 위 / 해설 위 — 문제당 파일 2개 */
  target: NoteTarget
}

/**
 * 저장되는 필기 캔버스 — DrawingCanvas 에 문제 필기 저장소(problemNotes)를 붙인다 (2026-09-02).
 * - 마운트·문제 변경: 캐시를 즉시 그리고, 서버 저장본을 확인해 교체
 * - 편집: 최신 획 목록만 저장소에 반영 (네트워크 없음)
 * - 문제 변경·언마운트: 변경분 업로드 (탭 종료·백그라운드는 저장소가 keepalive 로 처리)
 * 문제가 바뀔 때는 부모가 key 를 바꿔 새로 마운트한다 — 목 문항(코드 없음)도 획이 넘어가지 않게.
 */
export const ProblemNoteCanvas = forwardRef<DrawingCanvasHandle, ProblemNoteCanvasProps>(
  function ProblemNoteCanvas({ problemCode, target, ...canvasProps }, ref) {
    const innerRef = useRef<DrawingCanvasHandle>(null)
    const setRefs = useCallback(
      (handle: DrawingCanvasHandle | null) => {
        innerRef.current = handle
        if (typeof ref === 'function') ref(handle)
        else if (ref) ref.current = handle
      },
      [ref],
    )

    useEffect(() => {
      if (!problemCode) return
      // 캐시(없으면 빈 목록)로 즉시 그린다 — 서버 확인은 뒤이어. 조회 중 그린 획은 저장소가 서버본과 합친다
      const cached = peekProblemNote(problemCode, target)
      innerRef.current?.setStrokes(cached.strokes)
      let alive = true
      if (!cached.loaded) {
        loadProblemNote(problemCode, target).then((strokes) => {
          if (alive) innerRef.current?.setStrokes(strokes)
        })
      }
      return () => {
        alive = false
        void flushProblemNote(problemCode, target)
      }
    }, [problemCode, target])

    const handleStrokesChange = useCallback(
      (strokes: NoteStroke[]) => {
        if (problemCode) updateProblemNote(problemCode, target, strokes)
      },
      [problemCode, target],
    )

    return <DrawingCanvas ref={setRefs} {...canvasProps} onStrokesChange={handleStrokesChange} />
  },
)
