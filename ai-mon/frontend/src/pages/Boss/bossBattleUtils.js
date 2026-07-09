// 문제 텍스트에서 코드 블록 분리
export function parseQuestionText(raw) {
  const match = raw.match(/^([\s\S]*?)```(?:\w+)?\n([\s\S]*?)```([\s\S]*)$/)
  if (!match) return { text: raw.trim(), code: null, after: '' }
  
  let text = match[1].trim()
  let code = match[2].trimEnd()
  let after = match[3].trim()
  
  if (after.startsWith('# 출력:') || after.startsWith('출력:') || after.startsWith('#출력:')) {
    code = code + '\n\n' + after
    after = ''
  }
  
  let lines = text.split('\n')
  let lastNonEmptyIdx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) {
      lastNonEmptyIdx = i
      break
    }
  }
  if (lastNonEmptyIdx !== -1) {
    let targetLine = lines[lastNonEmptyIdx].trim()
    if (targetLine.startsWith('[') && (targetLine.includes(']') || targetLine.includes('파일') || targetLine.includes('.txt') || targetLine.includes('.json'))) {
      code = '# ' + targetLine + '\n\n' + code
      lines.splice(lastNonEmptyIdx, 1)
      text = lines.join('\n').trim()
    }
  }
  
  return { text, code, after }
}

// 문제 유형별 뱃지 스타일
export const TYPE_BADGE = {
  output_select:   { label: '💻 출력 선택',   bg: '#E0F2FE', color: '#0369A1' },
  multiple_choice: { label: '📋 객관식',       bg: '#EEEDFE', color: '#534AB7' },
  error_find:      { label: '🐛 오류 찾기',    bg: '#FFF5F5', color: '#DC2626' },
  fill_in_blank:   { label: '✏️ 빈칸 채우기', bg: '#F0FFF4', color: '#166534' },
  code_input:      { label: '⌨️ 코드 작성',   bg: '#F0EFFE', color: '#6D28D9' },
  code_multi_input: { label: '✏️ 빈칸 채우기', bg: '#F0FFF4', color: '#166534' },
}

// 코드 입력형 문제(답변 1개)의 2~3개 선택지 생성 헬퍼
export function getChoicesForCodeInput(answer, customChoices) {
  if (customChoices && customChoices.length >= 2) {
    return customChoices;
  }
  const base = answer ? String(answer).trim() : '';
  if (!base) return [];

  const commonDistractors = {
    'stream': ['get', 'response', 'iter_content'],
    'FastAPI()': ['FastAPI', 'app = FastAPI', 'ASGIApp()'],
    'post': ['get', 'put', 'delete'],
    'CORSMiddleware': ['CORS', 'CorsMiddleware', 'Middleware'],
    'await asyncio.sleep(1)': ['asyncio.sleep(1)', 'time.sleep(1)', 'await sleep(1)'],
    '*tasks': ['tasks', 'tasks*', 'list(tasks)'],
    'await fetch()': ['fetch()', 'await fetch', 'sync fetch()'],
    'async': ['await', 'def', 'sync'],
    'run': ['start', 'execute', 'loop'],
  };

  let dists = commonDistractors[base] || [];

  if (dists.length === 0) {
    if (base.endsWith('()')) {
      const name = base.slice(0, -2);
      dists = [name, `${name}(self)`, `new ${name}()`];
    } else if (base.includes('.')) {
      const parts = base.split('.');
      dists = [parts[parts.length - 1], parts[0]];
    } else {
      const general = ['await', 'async', 'yield', 'return', 'def', 'import', 'print', 'sleep'];
      dists = general.filter(g => g !== base);
    }
  }

  const count = dists.length >= 2 ? 2 : dists.length;
  const selectedDists = dists.slice(0, count);
  const list = Array.from(new Set([base, ...selectedDists])).filter(Boolean);
  
  // 간단한 셔플 함수
  return [...list].sort(() => 0.5 - Math.random());
}

