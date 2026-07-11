import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RunnerEngine } from './engine/RunnerEngine';
import { gameApi } from '../../../api';
import { incrementGamePlay } from '../Game';
import GameScaleFrame from '../GameScaleFrame';
import './AIrun.css';

export default function AIrun() {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const gameTokenRef = useRef(null);
  const navigate = useNavigate();
  const [startError, setStartError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!mountRef.current) return;

    let cancelled = false;

    async function init() {
      setStartError(null);
      gameTokenRef.current = null;

      // 게임 세션 토큰 취득 (실패 시 1회 재시도)
      let token = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await gameApi.startGame('runner');
          token = res.data.game_token;
          break;
        } catch {
          if (attempt === 1) {
            if (!cancelled) setStartError('네트워크 문제로 시작 실패. 다시 시도해주세요.');
            return;
          }
          // 첫 번째 실패 후 잠깐 대기하고 재시도
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (cancelled) return;
      gameTokenRef.current = token;

      let hasCleared = false;
      const handleGameOver = async (score, distance) => {
        if (hasCleared) return { data: null };
        hasCleared = true;
        incrementGamePlay('runner');
        return await gameApi.clearGame({
          game_id: 'runner',
          distance: Math.floor(distance),
          game_token: gameTokenRef.current,
        });
      };

      const handleGetNewToken = async () => {
        try {
          const res = await gameApi.startGame('runner');
          gameTokenRef.current = res.data.game_token;
          hasCleared = false; // 새 세션을 위한 초기화
          return res.data.game_token;
        } catch (err) {
          console.error('Failed to get new game token', err);
          return null;
        }
      };

      const engine = new RunnerEngine(mountRef.current, handleGameOver, handleGetNewToken);
      engineRef.current = engine;
      engine.init();
    }

    init();

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  // retryKey 변경 시 effect 재실행 → 재시도 버튼이 동작하게 함
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  if (startError) {
    return (
      <GameScaleFrame background="var(--clr-bg)">
        <div className="runner-game-wrapper">
          <button className="rg-back-btn" onClick={() => navigate(-1)}>✕</button>
          <div style={{ padding: '40px', textAlign: 'center', color: '#7A7A94' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
            <div>{startError}</div>
            <button
              style={{ marginTop: '20px', padding: '10px 24px', borderRadius: '99px', background: '#7F77DD', color: '#fff', border: 'none', cursor: 'pointer' }}
              onClick={() => setRetryKey(k => k + 1)}
            >
              다시 시도
            </button>
          </div>
        </div>
      </GameScaleFrame>
    );
  }

  return (
      <GameScaleFrame background="var(--clr-bg)">
      <div className="runner-game-wrapper">
        <button className="rg-back-btn" onClick={() => navigate(-1)}>✕</button>
        <div className="runner-game-mount" ref={mountRef} />
      </div>
    </GameScaleFrame>
  );
}
