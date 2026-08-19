/**
 * 검색 인풋용 전화번호 자동 하이픈.
 *
 * 숫자·하이픈만으로 이루어진 01x 시작 입력에만 010-1234-5678 형태를 만든다.
 * 이름·이메일이나 "5678" 같은 뒷자리 부분 검색은 건드리지 않아야 하므로
 * 그 외 입력은 원문 그대로 돌려준다.
 */
export function formatPhoneSearch(raw: string): string {
  if (!/^[\d-]*$/.test(raw)) return raw
  const digits = raw.replace(/\D/g, '')
  if (!digits.startsWith('01')) return raw
  const d = digits.slice(0, 11)
  const parts = [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11)].filter(Boolean)
  return parts.join('-')
}
