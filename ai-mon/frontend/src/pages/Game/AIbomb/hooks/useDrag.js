// ═══════════════════════════════════════════════════════════════
//  hooks/useDrag.js — 드래그 앤 드롭 핸들러
// ═══════════════════════════════════════════════════════════════

import { useRef } from 'react';

export function useDrag({ processAnswer, chips, status, ensureAudio }) {
  const draggingId = useRef(null);

  const handleDragStart = (e, chip) => {
    if (chip.used || status !== 'playing') return;
    ensureAudio(); // 첫 인터랙션으로 AudioContext + BGM 시작
    draggingId.current = chip.id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (draggingId.current === null) return;
    processAnswer(draggingId.current);
    draggingId.current = null;
  };

  return { handleDragStart, handleDragOver, handleDrop };
}
