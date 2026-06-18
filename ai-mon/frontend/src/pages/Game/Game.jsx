import { useNavigate } from 'react-router-dom'
import './Game.css'
import airunIconUrl from './AIrun/assets/AIRUNicon.png'
import aibombIconUrl from './AIbomb/assets/AIbombicon.png'

const GAMES = [
  {
    id: 'aipang',
    icon: <img src="/src/pages/Game/AipangPuzzle/assets/aipangicon.png" 
           style={{ width: 200, height: 200, display: 'block', margin: '0 auto' }} />,
    title: 'AI팡 퍼즐',
    desc: '우주 속 AI 친구들과 떠나는 퍼즐 모험!',
    reward: '왕관 획득',
    rewardIcon: '👑',
    route: '/game/aipang',
    available: true,
  },
  {
    id: 'knowledge',
    icon: '🤖',
    title: 'AI 지식 게임',
    desc: '우주 속 AI 친구들과 떠나는 퍼즐 모험!',
    reward: 'XP 100~300',
    rewardIcon: '⚡',
    route: null,
    available: false,
  },
  {
    id: 'runner',
    icon: <img src={airunIconUrl} alt="AIrun" style={{ width: 200, height: 200, display: 'block', margin: '0 auto' }} />,
    title: 'AI런 OX퀴즈',
    desc: '달리고! 피하고! 맞혀라!',
    reward: 'XP 200~500',
    rewardIcon: '⚡',
    route: '/game/runner',
    available: true,
  },
  {
    id: 'aibomb',
    icon: <img src={aibombIconUrl} alt="AIbomb" style={{ width: 200, height: 200, display: 'block', margin: '0 auto' }} />,
    title: 'AI 코딩 폭탄 해제',
    desc: '코딩을 배우고,코드를 입력해 폭탄을 해제하라 !',
    reward: 'XP 100',
    rewardIcon: '⚡',
    route: '/game/aibomb',
    available: true,
  },

  
]

export default function Game() {
  const navigate = useNavigate()

  return (
    <div className="game-page container">
      <h1 className="game-title">미니게임</h1>
      <p className="game-desc">
        학습 중 잠깐 쉬어가며 <strong>왕관</strong>과 <strong>XP</strong>를 추가로 획득하세요!
      </p>

      <div className="game-grid">
        {GAMES.map((g) => (
          <div
            key={g.id}
            className={`game-card card-glass${g.available ? ' game-card--active' : ''}`}
            onClick={() => g.available && g.route && navigate(g.route)}
            role={g.available ? 'button' : undefined}
            style={g.available ? { cursor: 'pointer' } : undefined}
          >
            <div className="game-card-icon">{g.icon}</div>
            <h2 className="game-card-title">{g.title}</h2>
            <p className="game-card-desc">{g.desc}</p>
            <div className="game-card-reward">
              <span className="reward-icon">{g.rewardIcon}</span>
              <span>{g.reward}</span>
            </div>
            {g.available
              ? <div className="game-play-btn">▶ 게임 시작</div>
              : <div className="game-coming-soon">준비중</div>
            }
          </div>
        ))}
      </div>
    </div>
  )
}
