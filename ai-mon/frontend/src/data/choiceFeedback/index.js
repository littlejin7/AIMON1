// 객관식 오답 "선택지별" 고정 해설 정적 번들 로더.
// backend/scripts/generate_choice_feedback.py 가 생성한 {level}/unit_{unit}.json 을
// (level, unit)별로 lazy import + 캐시. 히트 시 Claude 호출을 건너뛴다.
//
// 파일 구조: ./{level}/unit_{unit}.json = { question_id: { "A": "해설", "C": "해설", ... } }
//   (정답 선택지는 없음 = 오답 선택지만. 키는 보기 라벨 문자 A/B/C/D/E)

const modules = import.meta.glob('./*/unit_*.json')
const cache = {}

// (level, unit, questionId) -> { 선택지문자: 해설 } | null(미스)
export async function getChoiceFeedback(level, unit, questionId) {
  if (!level || unit === undefined || unit === null || !questionId) return null
  const path = `./${level}/unit_${unit}.json`
  const loader = modules[path]
  if (!loader) return null
  if (!cache[path]) {
    try {
      const mod = await loader()
      cache[path] = mod.default || mod
    } catch {
      cache[path] = {}
    }
  }
  return cache[path][questionId] || null
}

// 학생이 고른 보기 문자열("A. Hello") → 라벨 문자("A"). 없으면 choicesList 인덱스로 폴백.
const LABELS = ['A', 'B', 'C', 'D', 'E']
export function choiceLetterOf(selectedOpt, choicesList = []) {
  const m = /^\s*([A-Ea-e])[.)]/.exec(String(selectedOpt || ''))
  if (m) return m[1].toUpperCase()
  const idx = choicesList.findIndex(
    (c) => c === selectedOpt || String(c).replace(/\\n/g, '\n') === selectedOpt,
  )
  return idx >= 0 ? (LABELS[idx] || String(idx)) : null
}
