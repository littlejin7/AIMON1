import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import bossQnaIcon    from '../../assets/boss_finalqna.png'
import charSlimeIcon  from '../../assets/character_slime.png'
import charRobotIcon  from '../../assets/character_robot.png'
import charBubbleIcon from '../../assets/character_bubble.png'
import charGhostIcon  from '../../assets/character_final_ghost.png'
import { bossApi } from '../../api/index'

function parseQuestionCode(raw) {
  const match = raw.match(/^([\s\S]*?)```(?:python)?\n([\s\S]*?)```([\s\S]*)$/m)
  if (!match) return { questionText: raw.trim(), codeLines: null }
  const before = match[1].trim()
  const after  = match[3].trim()
  const code   = match[2].trimEnd()
  const questionText = [before, after].filter(Boolean).join('\n').trim()
  return { questionText, codeLines: code.split('\n') }
}

function QTerminal({ lines }) {
  return (
    <div className="mb-q-terminal">
      <div className="mb-q-code">
        {lines.map((line, i) => (
          <div key={i} style={{ color: line.trim().startsWith('#') ? '#4C4465' : '#D0ACFF' }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

const BOSS_TAUNTS = [
  '"엉뚱한 코드로 널 괴롭혀주지!"',
  '"Python 기초도 모르면 통과 불가야!"',
  '"빈칸을 채워야 살아남는다!"',
  '"직접 코드를 짜봐! 어디 한번 해봐!"',
  '"제법이군... 하지만 아직 멀었다! 💥"',
]

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
  lessonId,
  onSubmit,
  onNextQuestion,
  onEscape,
}) {
  const quizCardRef = useRef(null)
  const [usedHints, setUsedHints] = useState(0)
  const [currentHint, setCurrentHint] = useState('')
  const [hintLoading, setHintLoading] = useState(false)
  const [tauntIdx] = useState(() => Math.floor(Math.random() * BOSS_TAUNTS.length))

  useEffect(() => {
    setUsedHints(0)
    setCurrentHint('')
  }, [currentQuestion?.question_id])

  const handleGetHint = async () => {
    if (usedHints >= 2 || !currentQuestion) return
    setHintLoading(true)
    try {
      const isCodeType = currentQuestion.type === 'code_input' || currentQuestion.type === 'fill_in_blank'
      const res = await bossApi.getHint({
        question_id: currentQuestion.question_id,
        user_answer: isCodeType ? answerInput : (selectedOption || ''),
      })
      setCurrentHint(res.data.hint)
      setUsedHints(prev => prev + 1)
    } catch (err) {
      console.error(err)
    } finally {
      setHintLoading(false)
    }
  }

  const BOSS_HP_MAX = 1000
  const MY_HP_MAX   = 1000

  const characterIcon =
    user?.character === 'robot'        ? charRobotIcon  :
    user?.character === 'speech_bubble'? charBubbleIcon :
    user?.character === 'final_ghost'  ? charGhostIcon  :
    charSlimeIcon

  const isCodeType = currentQuestion.type === 'code_input'
  const isFibType  = currentQuestion.type === 'fill_in_blank'
  const { questionText, codeLines } = parseQuestionCode(currentQuestion.question)

  const bossScale  = 0.7 + 0.3 * Math.max(0, bossHp / BOSS_HP_MAX)
  const bossHpPct  = Math.max(0, (bossHp / BOSS_HP_MAX) * 100)
  const myHpPct    = Math.max(0, (myHp / MY_HP_MAX) * 100)
  const progressPct = Math.round(100 - bossHpPct)

  const levelLabel = (user?.lv || 1) <= 3 ? '초급' : (user?.lv || 1) <= 6 ? '중급' : '고급'

  return (
    <div className="mb-page">

      {/* ── 탑 네비 ── */}
      <div className="mb-topnav">
        <span className="mb-logo">AI MON</span>
        <div className="mb-crown-pill">👑 {user?.crowns ?? 0}</div>
        <div className="mb-user-info">
          <div className="mb-uavatar">
            <img src={characterIcon} alt="캐릭터" style={{ width: 20, height: 20, objectFit: 'contain' }} />
          </div>
          <div className="mb-utext">
            <span className="mb-uname">{user?.username || '플레이어'}</span>
            <span className="mb-ulvl">{levelLabel}</span>
          </div>
          <button className="mb-escape-btn" onClick={onEscape}>도망 🏃</button>
        </div>
      </div>

      {/* ── 진행도 스트립 ── */}
      <div className="mb-prog-strip">
        <span className="mb-prog-lbl">진행도</span>
        <div className="mb-prog-track">
          <div className="mb-prog-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="mb-prog-cnt">오답 {wrongCount} / 3</span>
      </div>

      {/* ── 본문 ── */}
      <div className="mb-content">

        {/* 보스 영역 */}
        <div className={`mb-boss-area ${bossShake ? 'boss-shake' : ''}`}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={bossQnaIcon}
              alt="보스"
              className={bossHit ? 'boss-hit' : ''}
              style={{
                width: 120,
                height: 120,
                objectFit: 'contain',
                transform: `scale(${bossScale})`,
                transition: 'transform 0.6s ease',
                transformOrigin: 'center bottom',
                display: 'block',
                filter: 'drop-shadow(0 4px 16px rgba(83,74,183,0.3))',
              }}
            />
            {dmgPopup && <div className="dmg-popup">-{dmgPopup}</div>}
          </div>
          <div className="mb-speech">{BOSS_TAUNTS[tauntIdx]}</div>
        </div>

        {/* HP 바 */}
        <div className="mb-hp-row">
          <div className="mb-hp-item">
            <div className="mb-hp-header">
              <img
                src={characterIcon}
                alt="나"
                className={myShake ? 'my-shake' : ''}
                style={{ width: 14, height: 14, objectFit: 'contain' }}
              />
              <span>내 에이몬</span>
              <span className="mb-hp-num">{myHp}/{MY_HP_MAX}</span>
            </div>
            <div className="mb-hp-track">
              <div className="mb-hp-fill-green" style={{ width: `${myHpPct}%` }} />
            </div>
          </div>
          <div className="mb-hp-item">
            <div className="mb-hp-header">
              <span>😈 {bossData?.boss_name || '보스'}</span>
              <span className="mb-hp-num">{bossHp}/{BOSS_HP_MAX}</span>
            </div>
            <div className="mb-hp-track">
              <div className="mb-hp-fill-red" style={{ width: `${bossHpPct}%` }} />
            </div>
          </div>
        </div>

        {/* 퀴즈 카드 */}
        <div ref={quizCardRef} className={`mb-qcard quiz-attack-wrap ${attackAnim ? 'attack-fly' : ''}`}>

          <div className="mb-qtitle">
            <div className="mb-qmark">❓</div>
            <div className="mb-qtext" style={{ whiteSpace: 'pre-line' }}>{questionText}</div>
          </div>

          {codeLines && <QTerminal lines={codeLines} />}

          {/* AI 채점 결과 */}
          {aiResult ? (
            aiResult.is_correct ? (
              <div className="mb-result-correct">
                <div>🎉 정답! 보스에게 데미지를 입혔습니다!</div>
                {!aiResult.is_clear && (
                  <button className="mb-subbtn" style={{ marginTop: 12 }} onClick={onNextQuestion}>
                    다음 문제 도전 ➔
                  </button>
                )}
              </div>
            ) : (
              <div className="mb-result-wrong">
                <div className="mb-result-wrong-header">
                  <span>🤖</span>
                  <span>Claude AI 분석</span>
                </div>
                <p style={{ color: '#26215C', lineHeight: 1.5, fontSize: '0.88rem', margin: 0 }}>
                  {aiResult.feedback}
                </p>
                {aiResult.hint && (
                  <div className="mb-hint-box">
                    <span style={{ color: '#534AB7', fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>💡 힌트</span>
                    <span style={{ color: '#555', fontSize: '0.85rem' }}>{aiResult.hint}</span>
                  </div>
                )}
                <button className="mb-subbtn" style={{ marginTop: 4 }} onClick={onNextQuestion}>
                  {myHp <= 0 || wrongCount >= 3 ? '결과 보기 (패배) ➔' : '다음 문제 도전 ➔'}
                </button>
              </div>
            )
          ) : (
            <>
              {/* 객관식 */}
              {!isCodeType && !isFibType && currentQuestion.choices && (
                <div className="mb-radio-opts">
                  {currentQuestion.choices.map((opt, idx) => {
                    const optionKey = opt.substring(0, 1)
                    return (
                      <div
                        key={idx}
                        className={`mb-ropt${selectedOption === optionKey ? ' sel' : ''}`}
                        onClick={() => setSelectedOption(optionKey)}
                      >
                        <div className="mb-rcircle" />
                        <span className="mb-rtext">{opt}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 빈칸 채우기 */}
              {isFibType && (
                <div className="mb-fib-row">
                  <span className="mb-fib-l">답</span>
                  <input
                    className="mb-fib-in"
                    type="text"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder="정답을 입력하세요..."
                    onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                  />
                </div>
              )}

              {/* 코드 입력 */}
              {isCodeType && (
                <div className="mb-e-terminal">
                  <div className="mb-e-top">
                    <span className="mb-e-lbl"># 코드를 작성하세요</span>
                  </div>
                  <textarea
                    className="mb-e-in"
                    rows={4}
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder={'for i in range(1, 6):\n    ...'}
                  />
                  <div className="mb-e-divider" />
                  <div className="mb-e-out">실행 결과가 여기 표시됩니다</div>
                </div>
              )}

              {/* 힌트 표시 */}
              {currentHint && (
                <div className="mb-hint-box">
                  <span style={{ color: '#534AB7', fontWeight: 'bold', display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>
                    💡 에이몬의 힌트
                  </span>
                  <span style={{ color: '#26215C', fontSize: '0.85rem', lineHeight: 1.5 }}>{currentHint}</span>
                </div>
              )}

              {/* 버튼 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="mb-hint-btn"
                  onClick={handleGetHint}
                  disabled={usedHints >= 2 || hintLoading || loading}
                >
                  {hintLoading ? '생성 중...' : `💡 힌트 (${2 - usedHints}회)`}
                </button>
                <button
                  className="mb-subbtn"
                  style={{ flex: 2 }}
                  onClick={onSubmit}
                  disabled={(!selectedOption && !answerInput.trim()) || loading}
                >
                  {loading ? '채점 중...' : '✓ 공격하기'}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
