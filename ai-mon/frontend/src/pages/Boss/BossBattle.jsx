import { useRef, useState, useEffect } from 'react'
import bossQnaIcon    from '../../assets/boss_finalqna.png'
import charSlimeIcon  from '../../assets/character_slime.png'
import charRobotIcon  from '../../assets/character_robot.png'
import charBubbleIcon from '../../assets/character_bubble.png'
import charGhostIcon  from '../../assets/character_final_ghost.png'

function parseQuestionCode(raw) {
  const match = raw.match(/^([\s\S]*?)```(?:python)?\n([\s\S]*?)```([\s\S]*)$/m)
  if (!match) return { questionText: raw.trim(), codeLines: null }
  const before = match[1].trim()
  const after  = match[3].trim()
  const code   = match[2].trimEnd()
  const questionText = [before, after].filter(Boolean).join('\n').trim()
  const codeLines    = code.split('\n')
  return { questionText, codeLines }
}

/** 슬라이드와 동일한 터미널 스타일 코드 블록 */
function TerminalBlock({ lines }) {
  return (
    <div style={{ marginBottom: '12px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #313244' }}>
      {/* 터미널 헤더 */}
      <div style={{
        background: '#181825', padding: '6px 12px',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
        <span style={{ color: '#585b70', fontSize: '0.72rem', marginLeft: 8 }}>Python</span>
      </div>
      {/* 코드 라인 */}
      <div style={{
        background: '#1e1e2e', padding: '0.85rem 1rem',
        fontFamily: 'monospace', fontSize: '1.4rem', color: '#cdd6f4',
        whiteSpace: 'pre', overflowX: 'auto',
      }}>
        {lines.map((line, i) => (
          <div key={i} style={{ color: line.trim().startsWith('#') ? '#6c7086' : '#cdd6f4' }}>
            <span style={{ color: '#585b70', userSelect: 'none', marginRight: 10 }}>&gt;&gt;&gt;</span>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BossBattle({
  bossData,
  currentQuestion,
  bossHp,
  myHp,
  wrongCount,
  selectedOption,
  setSelectedOption,
  answerInput,
  setAnswerInput,
  aiResult,
  loading,
  bossShake,
  myShake,
  bossHit,
  attackAnim,
  dmgPopup,
  user,
  onSubmit,
  onNextQuestion,
}) {
  const quizCardRef = useRef(null)

  const BOSS_HP_MAX = 1000
  const MY_HP_MAX   = 1000

  const characterIcon =
    user?.character === 'robot'        ? charRobotIcon  :
    user?.character === 'speech_bubble'? charBubbleIcon :
    user?.character === 'final_ghost'  ? charGhostIcon  :
    charSlimeIcon

  const isCodeType = currentQuestion.type === 'code_input' || currentQuestion.type === 'fill_in_blank'
  const { questionText, codeLines } = parseQuestionCode(currentQuestion.question)

  // 보스 HP에 따라 크기 감소 (0.7 ~ 1.0)
  const bossScale = 0.7 + 0.3 * Math.max(0, bossHp / BOSS_HP_MAX)
  
  return (
    <div className="boss-card battle-card card-glass animate-fade-in-up">

      {/* 보스 HP 바 */}
     <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.85rem', gap: '8px' }}>
        <span style={{ fontWeight: 'bold', color: '#f38ba8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          😈 {bossData?.boss_name}
        </span>
        <span style={{ whiteSpace: 'nowrap', flexShrink: 0, color: '#cdd6f4' }}>
          {bossHp} / {BOSS_HP_MAX} HP
        </span>
      </div>
      <div style={{ width: '100%', height: '12px', background: '#313244', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(0, (bossHp / BOSS_HP_MAX) * 100)}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #f38ba8, #e64d6d)',
          borderRadius: '6px',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
      {/* 보스 아바타 */}
      <div
        className={bossShake ? 'boss-shake' : ''}
        style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: '8px 0' }}
      >
        <img
          src={bossQnaIcon}
          alt="보스"
          className={`battle-boss-icon ${bossHit ? 'boss-hit' : ''}`}
          style={{
            width: '300px',
            height: '300px',
            objectFit: 'contain',
            transform: `scale(${bossScale})`,
            transition: 'transform 0.6s ease',
            transformOrigin: 'center bottom',
            display: 'block',
          }}
        />
        {dmgPopup && <div className="dmg-popup">-{dmgPopup}</div>}
      </div>

      {/* 퀴즈 카드 (공격 애니메이션 래퍼) */}
        <div ref={quizCardRef} className={`quiz-attack-wrap ${attackAnim ? 'attack-fly' : ''}`}>
          <h2 className="battle-q-title" style={{ whiteSpace: 'pre-line', fontSize: '1.3rem', marginBottom: codeLines ? '10px' : '8px' }}>
            {questionText}
          </h2>
          {codeLines && <TerminalBlock lines={codeLines} />}

        {/* AI 채점 결과 or 문제 입력 */}
        {aiResult ? (
          <div style={{ margin: '16px 0' }}>
            {aiResult.is_correct ? (
              <div style={{ padding: '16px', background: 'rgba(166,227,161,0.15)', border: '1px solid #a6e3a1', borderRadius: '12px', color: '#a6e3a1', fontWeight: 600, textAlign: 'center' }}>
                🎉 정답입니다! 보스에게 150 데미지를 입혔습니다!
                {!aiResult.is_clear && (
                  <div style={{ marginTop: '16px' }}>
                    <button className="btn btn-primary btn-full" onClick={onNextQuestion}>
                      다음 문제 도전 ➔
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'left', background: 'rgba(17,24,39,0.8)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(243,139,168,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.25rem' }}>🤖</span>
                  <span style={{ fontWeight: 700, color: '#cba6f7' }}>Claude AI 분석</span>
                </div>
                <p style={{ color: '#cdd6f4', lineHeight: 1.5, fontSize: '0.9rem', margin: 0 }}>
                  {aiResult.feedback}
                </p>
                {aiResult.hint && (
                  <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', borderLeft: '3px solid #f9e2af' }}>
                    <span style={{ color: '#f9e2af', fontWeight: 600, display: 'block', marginBottom: '2px', fontSize: '0.8rem' }}>💡 힌트</span>
                    <span style={{ color: '#a0a0b0', fontSize: '0.85rem' }}>{aiResult.hint}</span>
                  </div>
                )}
                <div style={{ marginTop: '16px' }}>
                  {myHp <= 0 || wrongCount >= 3 ? (
                    <button className="btn btn-danger btn-full" onClick={onNextQuestion}>
                      결과 보기 (패배) ➔
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-full" onClick={onNextQuestion}>
                      다음 문제 도전 ➔
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 객관식 */}
            {!isCodeType && currentQuestion.choices && (
              <div className="battle-choices" style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0' }}>
                {currentQuestion.choices.map((opt, idx) => {
                  const optionKey = opt.substring(0, 1)
                  return (
                    <button
                      key={idx}
                      className={`btn ${selectedOption === optionKey ? 'btn-primary' : 'btn-ghost'}`}
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontSize: '1.15rem',
                        justifyContent: 'flex-start',
                        border: selectedOption === optionKey
                          ? '1px solid var(--clr-primary)'
                          : '1px solid rgba(255,255,255,0.1)',
                      }}
                      onClick={() => setSelectedOption(optionKey)}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {/* 단답/코드 입력 */}
            {isCodeType && (
              <div style={{ margin: '16px 0' }}>
                <input
                  type="text"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  className="input"
                  placeholder="정답을 입력하세요"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                />
              </div>
            )}

            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={onSubmit}
              disabled={(!selectedOption && !answerInput.trim()) || loading}
            >
              공격하기 🚀
            </button>
          </>
        )}
      </div>

      {/* 내 캐릭터 HP 바 */}
      <div className="my-hp-bar" style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <img
          src={characterIcon}
          alt="내 캐릭터"
          className={`my-avatar ${myShake ? 'my-shake' : ''}`}
          style={{ width: '40px', height: '40px', objectFit: 'contain' }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 'bold', color: '#a6e3a1' }}>🟢 내 에이몬</span>
            <span>{myHp} / {MY_HP_MAX} HP (오답 {wrongCount}/3)</span>
          </div>
          <div className="hp-bar" style={{ background: '#313244', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
            <div className="hp-fill" style={{ width: `${(myHp / MY_HP_MAX) * 100}%`, background: '#a6e3a1', transition: 'width 0.3s ease', height: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
