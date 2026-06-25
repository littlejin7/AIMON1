// 보드 중심 화면 좌표 계산
export function getBoardScreenCenter() {
  const el = document.getElementById('board-wrap')
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

// 데미지 숫자를 DOM에 직접 삽입 (카드 위에 float)
export function showDmgNumber(dmg, cardId) {
  const cardEl = document.getElementById(cardId)
  if (!cardEl) return
  const rect = cardEl.getBoundingClientRect()
  const el = document.createElement('div')
  el.className = 'dmg-num' + (dmg >= 200 ? ' big' : '')
  el.textContent = '-' + dmg.toLocaleString()
  el.style.left = (rect.left + rect.width / 2) + 'px'
  el.style.top  = (rect.top + 8) + 'px'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1100)
}

// 콤보 배율 텍스트를 DOM에 직접 삽입
export function showComboText(combo, mult) {
  const el = document.createElement('div')
  el.className = 'combo-text'
  el.textContent = `COMBO ×${mult.toFixed(1)}!`
  el.style.cssText = 'left:50%;top:42%;'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1150)
}
