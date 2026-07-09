// 파이썬 코드 문법별 색상 강조(하이라이팅) 공용 유틸.
// 유닛보스/엔드보스(BossBattle.jsx)에서 쓰던 토크나이저를 레슨/퀴즈/미니보스에서도
// 재사용할 수 있도록 분리한 것.

export const KW = new Set([
  'False','None','True','and','as','assert','async','await',
  'break','class','continue','def','del','elif','else','except',
  'finally','for','from','global','if','import','in','is',
  'lambda','nonlocal','not','or','pass','raise','return',
  'try','while','with','yield',
])

export const BI = new Set([
  'print','len','range','input','int','float','str','bool','list',
  'dict','set','tuple','type','isinstance','hasattr','getattr',
  'setattr','abs','all','any','bin','chr','dir','enumerate',
  'filter','format','frozenset','hex','id','iter','map','max',
  'min','next','open','ord','pow','repr','reversed','round',
  'sorted','sum','super','vars','zip',
])

export const SH_COLORS = {
  kw:      '#C586C0',  // 키워드 — 핑크
  bi:      '#DCDCAA',  // 빌트인 — 노랑
  fn:      '#DCDCAA',  // def 함수명 — 노랑 bold
  cn:      '#4EC9B0',  // class명 — 민트
  ca:      '#DCDCAA',  // 호출 — 노랑
  st:      '#CE9178',  // 문자열 — 오렌지
  cm:      '#6A9955',  // 주석 — 그린
  nm:      '#B5CEA8',  // 숫자 — 연두
  dc:      '#D7BA7D',  // 데코레이터 — 황금
  pm:      '#9CDCFE',  // 변수 — 하늘파랑
  op:      '#D4D4D4',  // 연산자
}

const TOKEN_RE = [
  { t: 'cm', r: /^(#[^\n]*)/ },
  { t: 'st', r: /^("""[\s\S]*?"""|'''[\s\S]*?''')/ },
  { t: 'st', r: /^(f"""[\s\S]*?"""|f'''[\s\S]*?'''|f"[^"\\]*(?:\\.[^"\\]*)*"|f'[^'\\]*(?:\\.[^'\\]*)*')/ },
  { t: 'st', r: /^("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')/ },
  { t: 'nm', r: /^(0x[\da-fA-F]+|0b[01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)/ },
  { t: 'dc', r: /^(@\w+)/ },
  { t: 'id', r: /^([A-Za-z_]\w*)/ },
  { t: 'op', r: /^([+\-*/%=<>!&|^~:,.;()\[\]{}]+)/ },
  { t: 'sp', r: /^(\s+)/ },
  { t: 'xx', r: /^(.)/ },
]

export function tokenizeCode(code) {
  const tokens = []
  let rest = code
  let prev = null
  while (rest.length > 0) {
    for (const { t, r } of TOKEN_RE) {
      const m = rest.match(r)
      if (!m) continue
      const val = m[1]
      let type = t
      if (t === 'id') {
        if (KW.has(val))      type = (val === 'def' ? 'kw-def' : val === 'class' ? 'kw-cls' : 'kw')
        else if (BI.has(val)) type = 'bi'
        else if (prev === 'kw-def')  type = 'fn'
        else if (prev === 'kw-cls')  type = 'cn'
        else if (rest.length > val.length && rest[val.length] === '(') type = 'ca'
        else type = 'pm'
      }
      if (t !== 'sp') prev = type
      tokens.push({ type, val })
      rest = rest.slice(val.length)
      break
    }
  }
  return tokens
}

// 한 줄(line) 단위로 토큰화해서 색상 span 배열을 반환.
// 레슨/퀴즈처럼 줄마다 별도 <div>로 렌더링하는 구조에 맞춘 헬퍼.
export function highlightLineTokens(line, keyPrefix = '') {
  const tokens = tokenizeCode(line)
  return tokens.map((tok, i) => {
    const baseType = tok.type.startsWith('kw') ? 'kw' : tok.type
    const color = SH_COLORS[baseType]
    const bold = tok.type === 'fn' || tok.type === 'cn'
    if (!color) return <span key={`${keyPrefix}${i}`}>{tok.val}</span>
    return (
      <span key={`${keyPrefix}${i}`} style={{ color, fontWeight: bold ? 700 : undefined }}>
        {tok.val}
      </span>
    )
  })
}

// 코드 전체(여러 줄)를 통짜로 토큰화해서 렌더링하는 컴포넌트.
// 유닛보스/엔드보스에서 쓰던 PythonHighlighter와 동일한 동작.
export function PythonHighlighter({ code, style }) {
  if (!code) return null
  const tokens = tokenizeCode(code)
  return (
    <pre style={{
      margin: 0, padding: 0, background: 'transparent',
      fontFamily: "'Courier New', monospace",
      fontSize: '15px', lineHeight: 1.7, whiteSpace: 'pre',
      overflowX: 'auto', color: '#D4D4D4', tabSize: 4,
      ...style,
    }}>
      <code>
        {tokens.map((tok, i) => {
          const baseType = tok.type.startsWith('kw') ? 'kw' : tok.type
          const color = SH_COLORS[baseType]
          const bold  = tok.type === 'fn' || tok.type === 'cn'
          if (!color) return <span key={i}>{tok.val}</span>
          return (
            <span key={i} style={{ color, fontWeight: bold ? 700 : undefined }}>
              {tok.val}
            </span>
          )
        })}
      </code>
    </pre>
  )
}
