// fill_in_blank 오답 고정 해설 정적 번들 로더.
// backend/scripts/generate_fill_feedback.py 가 생성한 {level}/unit_{unit}.json 을
// (level, unit)별로 lazy import 하고 메모리에 캐시한다. 히트 시 Claude 호출을 건너뛴다.
//
// 파일 구조: ./{level}/unit_{unit}.json = { question_id: "고정 해설" }

const modules = import.meta.glob('./*/unit_*.json')
const cache = {}

// (level, unit, questionId) -> 고정 해설 문자열 | null(미스)
export async function getFillFeedback(level, unit, questionId) {
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
