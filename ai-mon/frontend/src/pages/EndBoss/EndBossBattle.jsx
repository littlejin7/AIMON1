import { useRef } from 'react'
import endbossQnaIcon from '../../assets/endboss_finalqna.png'
import charSlimeIcon  from '../../assets/character_slime.png'
import charRobotIcon  from '../../assets/character_robot.png'
import charBubbleIcon from '../../assets/character_bubble.png'
import charGhostIcon  from '../../assets/character_final_ghost.png'

export default function EndBossBattle({
  bossData,
  currentQuestion,
  bossHp,
  myHp,
  phase,
  phase3Tries,
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

  const BOSS_HP_MAX = 1800
  const MY_HP_MAX   = 1200

  const characterIcon =
    user?.character === 'robot'        ? charRobotIcon  :
    user?.character === 'speech_bubble'? charBubbleIcon :
    user?.character === 'final_ghost'  ? charGhostIcon  :
    charSlimeIcon

  const isCodeType = currentQuestion.type === 'code_input' || currentQuestion.type === 'fill_in_blank'

  return (
    <div className="boss-card battle-card card-glass animate-fade-in-up">

      {/* 보스 HP 바 */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.85rem', gap: '8px' }}>
          <span style={{ fontWeight: 'bold', color: '#f38ba8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            😈 {bossData?.boss_name || '엔드보스'} (Phase {phase})
          </span>
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0, color: '#cdd6f4' }}>
            {bossHp} / {BOSS_HP_MAX} HP
          </span>
        </div>
        <div style={{ width: '100%', height: '12px', background: '#313244', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.max(0, (bossHp / BOSS_HP_MAX) * 100)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #ff6b6b, #c0392b)',  /* BossBattle과 색상 다름 */
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
          src={endbossQnaIcon}
          alt="엔드보스"
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
        <h2 className="battle-q-title" style={{ whiteSpace: 'pre-line', fontSize: '1.1rem', marginBottom: '8px' }}>
          {currentQuestion.question}
        </h2>

        {/* AI 채점 결과 or 문제 입력 */}
        {aiResult ? (
          <div style={{ margin: '16px 0' }}>
            {aiResult.is_correct ? (
              <div style={{ padding: '16px', background: 'rgba(166,227,161,0.15)', border: '1px solid #a6e3a1', borderRadius: '12px', color: '#a6e3a1', fontWeight: 600, textAlign: 'center' }}>
                🎉 정답입니다! 보스에게 강력한 데미지를 입혔습니다!
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
                <div style={{ marginTop: '16px' }}>
                  {myHp <= 0 || phase3Tries >= 3 ? (
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
                {currentQuestion.type === 'code_input' ? (
                  <textarea
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    className="input"
                    placeholder="코드를 입력하세요"
                    rows={10}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#cdd6f4',
                      border: '1px solid rgba(255,255,255,0.3)',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      resize: 'vertical',
                      lineHeight: 1.6,
                      padding: '10px 12px',
                      borderRadius: '8px',
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    className="input"
                    placeholder="정답을 입력하세요"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                  />
                )}
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
            <span>{myHp} / {MY_HP_MAX} HP{phase === 3 && ` (Phase 3 오답 ${phase3Tries}/3)`}</span>
          </div>
          <div className="hp-bar" style={{ background: '#313244', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
            <div className="hp-fill" style={{ width: `${(myHp / MY_HP_MAX) * 100}%`, background: '#a6e3a1', transition: 'width 0.3s ease', height: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
