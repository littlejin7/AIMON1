// ═══════════════════════════════════════════════════════════════
//  components/ResultOverlay.jsx — 성공 / 게임오버 오버레이
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TOTAL_STAGES } from '../questions';
import { ExplosionSprite, DefusedSprite } from '../sprites';

export default function ResultOverlay({ status, stage, question, onRestart }) {
  const navigate = useNavigate();

  if (status === 'success') {
    return (
      <div className="bd-overlay bd-overlay--success">
        <div className="bd-result-card">
          <div className="bd-result-header">
            <DefusedSprite />
          </div>
          <h2 className="bd-result-title">🎉 전부 해제 성공!</h2>
          <p className="bd-result-sub">{TOTAL_STAGES}스테이지를 모두 클리어했습니다</p>
          <div className="bd-result-stats">
            <div className="bd-stat">
              <span className="bd-stat-val">{TOTAL_STAGES}</span>
              <span className="bd-stat-label">스테이지</span>
            </div>
            <div className="bd-stat">
              <span className="bd-stat-val" style={{ color: '#ffd700' }}>★★★</span>
              <span className="bd-stat-label">평가</span>
            </div>
          </div>
          <div className="bd-result-btns">
            <button className="bd-btn bd-btn--primary" onClick={onRestart}>다시 도전</button>
            <button className="bd-btn bd-btn--secondary" onClick={() => navigate('/game')}>게임 목록</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'gameover') {
    return (
      <div className="bd-overlay bd-overlay--gameover">
        <div className="bd-result-card">
          <div className="bd-result-header">
            <ExplosionSprite />
          </div>
          <h2 className="bd-result-title">💥 폭발!</h2>
          <p className="bd-result-sub">시간이 초과됐습니다</p>
          <div className="bd-answer-reveal">
            <span className="bd-answer-label">정답</span>
            <code className="bd-answer-code">{question.answer}</code>
          </div>
          <p className="bd-stage-reached">
            스테이지 <strong>{stage + 1}</strong>/{TOTAL_STAGES} 도달
          </p>
          <div className="bd-result-btns">
            <button className="bd-btn bd-btn--primary" onClick={onRestart}>다시 도전</button>
            <button className="bd-btn bd-btn--secondary" onClick={() => navigate('/game')}>게임 목록</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
