// 문제 텍스트에서 코드 블록 분리
export function parseQuestionText(raw) {
  const match = raw.match(/^([\s\S]*?)```(?:\w+)?\n([\s\S]*?)```([\s\S]*)$/)
  if (!match) return { text: raw.trim(), code: null, after: '' }
  return { text: match[1].trim(), code: match[2].trimEnd(), after: match[3].trim() }
}

// 문제 유형별 뱃지 스타일
export const TYPE_BADGE = {
  output_select:   { label: '💻 출력 선택',   bg: '#E0F2FE', color: '#0369A1' },
  multiple_choice: { label: '📋 객관식',       bg: '#EEEDFE', color: '#534AB7' },
  error_find:      { label: '🐛 오류 찾기',    bg: '#FFF5F5', color: '#DC2626' },
  fill_in_blank:   { label: '✏️ 빈칸 채우기', bg: '#F0FFF4', color: '#166534' },
  code_input:      { label: '⌨️ 코드 작성',   bg: '#F0EFFE', color: '#6D28D9' },
}
