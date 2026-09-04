/**
 * 이 브라우저에 남는 개인 흔적 정리 — 로그아웃·탈퇴 공용 (MyPage 에 있던 것을 탈퇴 화면과 나눠 쓰기 위해 분리 · 2026-09-04).
 * 특히 풀이 재전송 큐를 안 지우면 같은 브라우저에서 다른 계정으로 로그인했을 때
 * 이전 사람의 풀이가 새 계정으로 전송된다.
 */
export function clearLocalTraces(): void {
  try {
    localStorage.removeItem('pullit_trial_progress')
    ;[
      'pullit_trial_session',
      'pullit_attempt_queue',
      'pullit_signup_form', // 가입 폼 보존분 (이름·생년월일·전화번호)
      'pullit_post_login_redirect',
      'pullit_oauth_state_naver',
      'pullit_oauth_state_google',
    ].forEach((key) => sessionStorage.removeItem(key))
  } catch {
    /* storage 접근 불가 — 무시 */
  }
}
