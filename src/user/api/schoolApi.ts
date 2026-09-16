import { api } from '@/user/api/authApi'

/**
 * 학교 기능 노출 스위치 (2026-09-14 · AI-314)
 * 백엔드 배포·NEIS 첫 동기화 전까지 false — 가입 학교 단계 · 프로필 학교 필드 · 홈 입력 팝업 · 어드민 학교 메뉴/컬럼을 전부 숨긴다.
 * 오픈 시 true 로만 바꾸면 된다 (코드 삭제·주석 없음)
 */
// 로컬 개발 서버(npm run dev)에서는 항상 켜서 바로 볼 수 있게, 빌드(dev·prod 배포)에서는 false (2026-09-16)
export const SCHOOL_FEATURE_ENABLED = import.meta.env.DEV || false
/**
 * 어드민 학교 관리 노출 스위치 (2026-09-16) — 유저 화면과 별개로 먼저 켠다.
 * 사이드바 "학교 > 학교 관리" 메뉴와 회원 목록 학교 컬럼. 운영에서 "지금 최신화"로 NEIS 첫 동기화를 하기 위함
 */
export const SCHOOL_ADMIN_ENABLED = true

/** 학교급 — 서버 SchoolGrade. users.grade(학년)와 이름만 같다 */
export type SchoolGrade = 'MIDDLE' | 'HIGH'
/** 학교 없음 사유 — 서버 SchoolNoneReason */
export type SchoolNoneReason = 'RETAKE' | 'GED' | 'OVERSEAS' | 'OTHER'
/**
 * 화면에는 "기타" 하나만 쓴다 (2026-09-16 결정) — 검정고시·해외·N수생 구분은 묻지 않는다.
 * RETAKE·GED·OVERSEAS 는 서버 enum 호환용으로만 남긴 라벨 (기존 값 표시)
 */
export const SCHOOL_NONE_LABEL: Record<SchoolNoneReason, string> = {
  RETAKE: '기타',
  GED: '기타',
  OVERSEAS: '기타',
  OTHER: '기타',
}
export const HIGH_TYPE_LABEL: Record<string, string> = {
  GENERAL: '일반고', SPECIAL_PURPOSE: '특목고', AUTONOMOUS: '자율고', SPECIALIZED: '특성화고',
}

export interface School {
  id: number
  name: string
  grade: SchoolGrade
  region: string | null
  address: string | null
  highType: string | null
  /** 학교명 첫 글자 — 로고 대신 원형 배지 */
  initial: string
}

interface BaseResponse<T> { successCode: string; message: string; data: T }

/**
 * 학교 검색 — 우리 DB(schools)만 조회 (NEIS 는 서버 배치가 주 1회 동기화). 운영 중인 학교만, 이름 부분 일치, 최대 30건.
 * 동명 학교(강동고 등 412개)가 많아 region·address 를 같이 보여줘야 고를 수 있다
 */
export async function searchSchools(q: string, grade?: SchoolGrade | null): Promise<School[]> {
  const { data } = await api.get<BaseResponse<School[]>>('/api/schools', { params: { q, grade: grade ?? undefined } })
  return data.data ?? []
}

/** 내 학교 변경 — schoolId 또는 noneReason 중 하나 (가입 뒤 홈 팝업·프로필 편집) */
export async function updateSchool(choice: { schoolId: number } | { noneReason: SchoolNoneReason }): Promise<void> {
  await api.patch('/api/users/me/school', choice)
}
