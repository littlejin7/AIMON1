import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AipangPuzzle.css';
import { useGameLogic } from './hooks/useGameLogic';
import { GAME_W, GAME_H } from './constants/gameConstants';
import BossSection from './components/BossSection';
import Board      from './components/Board';
import CtrlBar    from './components/CtrlBar';
import BossIntro  from './components/BossIntro';
import {
  PopupTitle,
  PopupClear,
  PopupOver,
  PopupFinal,
} from './components/Popup';

/**
 * AI팡 퍼즐 — 루트 컴포넌트
 * 모든 서브 컴포넌트와 게임 로직 훅을 조합하는 진입점
 */
export default function AipangPuzzle() {
  const pCanvasRef  = useRef(null); // 파티클 캔버스
  const lCanvasRef  = useRef(null); // 번개 캔버스
  const gameRootRef = useRef(null); // 게임 루트 (스케일 대상)
  const navigate    = useNavigate(); 

  // 게임 화면에서만 body 스타일 적용
  useEffect(() => {
    document.body.classList.add('aipang-active');
    return () => document.body.classList.remove('aipang-active');
  }, []);
  
  const {
    grid,
    moves,
    unitHp,
    unitHpMax,
    finalHp,
    finalHpMax,
    unitBossName,
    stageDisplay,
    selected,
    bgmMuted,
    cellAnims,
    bossUI,
    popups,
    onCellClick,
    handleStart,
    handleNext,
    handleRetry,
    handleRestart,
    handleBossIntroOk,
    handleBgmToggle,
    handleRefresh,
  } = useGameLogic(pCanvasRef, lCanvasRef);

  // ── 화면 크기에 맞게 게임 스케일 조정 ──
  useEffect(() => {
    const applyScale = () => {
      const s = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H, 1.5);
      const el = gameRootRef.current;
      if (!el) return;
      el.style.transform = `scale(${s})`;
      el.style.width     = GAME_W + 'px';
      el.style.height    = GAME_H + 'px';
      // 가운데 정렬은 부모(.aipang-wrap)의 flex 중앙정렬에 맡긴다.
      // marginTop으로 다시 밀어내면 세로 중앙정렬이 깨지므로 제거.
    };
    applyScale();
    window.addEventListener('resize', applyScale);
    return () => window.removeEventListener('resize', applyScale);
  }, []);

  // ── 캔버스 크기 동기화 ──
  useEffect(() => {
    const resize = () => {
      if (pCanvasRef.current) {
        pCanvasRef.current.width  = window.innerWidth;
        pCanvasRef.current.height = window.innerHeight;
      }
      if (lCanvasRef.current) {
        lCanvasRef.current.width  = window.innerWidth;
        lCanvasRef.current.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <>
      {/* 파티클 / 번개 캔버스 레이어 */}
      <canvas id="particle-layer"  ref={pCanvasRef} />
      <canvas id="lightning-layer" ref={lCanvasRef} />

      {/* 게임 메인 영역 */}
      <div id="game-root" ref={gameRootRef}>
        <div id="frame-container">

          {/* 상단: 보스 카드 + 정보 스트립 */}
          <BossSection
            unitBossName={unitBossName}
            unitHp={unitHp}
            unitHpMax={unitHpMax}
            finalHp={finalHp}
            finalHpMax={finalHpMax}
            bossUI={bossUI}
            moves={moves}
            stageDisplay={stageDisplay}
          />

          {/* 하단: BGM / 새로고침 버튼 */}
          <CtrlBar
            bgmMuted={bgmMuted}
            onBgmToggle={handleBgmToggle}
            onRefresh={handleRefresh}
          />

          {/* 퍼즐 보드 */}
          <Board
            grid={grid}
            selected={selected}
            cellAnims={cellAnims}
            onCellClick={onCellClick}
          />

        </div>
      </div>

      {/* 오버레이: 보스 등장 → 타이틀 → 클리어 → 오버 → 최종 */}
      <BossIntro visible={popups.bossIntro} onOk={handleBossIntroOk} />
      <PopupTitle visible={popups.title}    onStart={handleStart}    />
      <PopupClear visible={popups.clear}    onNext={handleNext}      />
      <PopupOver  visible={popups.over}   onRetry={handleRetry}    onHome={() => navigate('/')} />
      <PopupFinal visible={popups.final}  onRestart={handleRestart} onHome={() => navigate('/')} />
    </>
  );
}
