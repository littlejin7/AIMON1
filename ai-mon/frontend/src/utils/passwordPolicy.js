// 비밀번호 정책 (회원가입 / 비밀번호 변경 / 비밀번호 재설정 공통)
// 규칙: 최소 8자 + 영문 1자 이상 + 숫자 1자 이상 + 특수문자 1자 이상
export const PW_MIN_LENGTH = 8

const LETTER_RE = /[A-Za-z]/
const NUMBER_RE = /[0-9]/
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/

// 각 조건의 충족 여부를 반환 (UI 힌트용)
export function checkPassword(pw) {
  const v = pw || ''
  return {
    length: v.length >= PW_MIN_LENGTH,
    letter: LETTER_RE.test(v),
    number: NUMBER_RE.test(v),
    special: SPECIAL_RE.test(v),
  }
}

// 정책을 모두 만족하는지 여부
export function isValidPassword(pw) {
  const c = checkPassword(pw)
  return c.length && c.letter && c.number && c.special
}

// 만족하지 못한 경우 안내 문구, 통과 시 빈 문자열
export function passwordError(pw) {
  const v = pw || ''
  if (v.length < PW_MIN_LENGTH) return `8자 이상 입력해주세요 (${v.length}/8)`
  if (!LETTER_RE.test(v)) return '영문을 1자 이상 포함해주세요'
  if (!NUMBER_RE.test(v)) return '숫자를 1자 이상 포함해주세요'
  if (!SPECIAL_RE.test(v)) return '특수문자를 1자 이상 포함해주세요'
  return ''
}

export const PW_POLICY_TEXT = '영문·숫자·특수문자 포함 8자 이상'
