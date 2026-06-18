import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RunnerEngine } from './engine/RunnerEngine';
import './AIrun.css';

export default function AIrun() {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new RunnerEngine(mountRef.current);
    engineRef.current = engine;
    engine.init();
    return () => { engine.destroy(); };
  }, []);

  return (
    <div className="runner-game-wrapper">
      <button className="rg-back-btn" onClick={() => navigate(-1)}>← 뒤로</button>
      <div className="runner-game-mount" ref={mountRef} />
    </div>
  );
}
