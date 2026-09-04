/** 회원 탈퇴 사유 — 서버 enum WithdrawalReason 과 1:1 (2026-09-04). 순서 = 탈퇴 화면 노출 순서 */
export type WithdrawalReason =
  | 'NOT_TARGET'
  | 'TOO_COMPLEX'
  | 'BUGS'
  | 'CONTENT_QUALITY'
  | 'LOW_USAGE'
  | 'REJOIN'
  | 'PRIVACY'
  | 'OTHER'

export const WITHDRAWAL_REASONS: { code: WithdrawalReason; label: string }[] = [
  { code: 'NOT_TARGET', label: '서비스 대상이 아님' },
  { code: 'TOO_COMPLEX', label: '서비스 이용이 복잡하고 어려움' },
  { code: 'BUGS', label: '서비스의 장애와 오류' },
  { code: 'CONTENT_QUALITY', label: '문제·해설이 기대에 못 미침' },
  { code: 'LOW_USAGE', label: '잘 쓰지 않게 됨' },
  { code: 'REJOIN', label: '탈퇴 후 신규 가입하기 위함' },
  { code: 'PRIVACY', label: '개인정보 및 보안 우려' },
  { code: 'OTHER', label: '기타' },
]
