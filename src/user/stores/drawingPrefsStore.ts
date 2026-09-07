import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { EraserMode, StrokeTool } from '@/user/components/quiz/DrawingCanvas'

/** 프리셋 두께 3단 (0.05 ~ 1.0) — DrawingToolbar 와 같은 정의 */
export type Presets = [number, number, number]
export type PresetTool = 'mono' | 'marker'

/**
 * 필기 도구 설정 — 브라우저에 남겨 다음 풀이·해설 화면에서도 같은 세팅으로 시작한다 (2026-09-07).
 * 도구·색·두께(도구별 프리셋 3단과 선택 자리)·지우개 종류/크기·손필기 허용. 문제·해설 화면(TrialQuizPage ·
 * ReviewScreen)과 툴바가 이 스토어를 같이 쓴다.
 *
 * "필기 도구 on/off"(상단 펜 토글)는 일부러 안 남긴다 — 한 번 끈 게 다음 방문까지 이어지면 툴바가 사라진 채
 * 시작해 "필기가 없어졌다" 로 읽힌다. 화면마다 켜진 채 시작 (2026-09-06 정책).
 * 진행 표식이 아니라 취향 값이라 진입점 리셋 대상이 아니다. QA 초기화는 ?qa-reset (main.tsx).
 */
interface DrawingPrefsState {
  tool: StrokeTool
  color: string
  /** 현재 도구의 두께 (슬라이더 값) — 도구를 바꾸면 툴바가 그 도구의 프리셋으로 다시 맞춘다 */
  size: number
  eraserMode: EraserMode
  eraserSizeIdx: number
  allowFinger: boolean
  presetsByTool: Record<PresetTool, Presets>
  activeIdxByTool: Record<PresetTool, number>
  /** 도구별 마지막 색 — 펜은 검정, 형광펜은 노랑에서 시작 */
  colorByTool: Record<PresetTool, string>
  set: (patch: Partial<Omit<DrawingPrefsState, 'set'>>) => void
}

export const DEFAULT_PRESETS: Record<PresetTool, Presets> = {
  mono: [0.05, 0.15, 0.3],
  marker: [0.2, 0.35, 0.55],
}

export const useDrawingPrefsStore = create<DrawingPrefsState>()(
  persist(
    (set) => ({
      tool: 'mono',
      color: '#120C0B',
      size: 0.15, // 펜 기본 프리셋(가운데)
      eraserMode: 'stroke', // 지우개 기본 전체 (2026-09-04)
      eraserSizeIdx: 1,
      allowFinger: false, // 아이패드 손바닥 걸침 방지 · 기본 펜만
      presetsByTool: DEFAULT_PRESETS,
      activeIdxByTool: { mono: 1, marker: 1 },
      colorByTool: { mono: '#120C0B', marker: '#FFD60A' },
      set: (patch) => set(patch),
    }),
    {
      name: 'pullit_drawing_prefs',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        tool: s.tool === 'laser' ? 'mono' : s.tool, // 레이저는 일시 도구 — 다음 시작은 펜
        color: s.color,
        size: s.size,
        eraserMode: s.eraserMode,
        eraserSizeIdx: s.eraserSizeIdx,
        allowFinger: s.allowFinger,
        presetsByTool: s.presetsByTool,
        activeIdxByTool: s.activeIdxByTool,
        colorByTool: s.colorByTool,
      }),
    },
  ),
)
