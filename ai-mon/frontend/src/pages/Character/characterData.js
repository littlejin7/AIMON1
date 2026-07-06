import {
  IconFirstStep,
  IconStreak,
  IconBossSlayer,
  IconAiExplorer,
  IconUnitMaster,
  IconAimonMaster,
} from './CharacterIcons'

// XP → 레벨 계산
export function calcLevel(xp) {
  let lv = 1, accumulated = 0
  while (lv < 30) {
    const needed = lv * 1000
    if (xp < accumulated + needed) return { lv, xpInLevel: xp - accumulated, xpForNext: needed }
    accumulated += needed
    lv++
  }
  const extraXp = xp - accumulated
  const extraLv = Math.floor(extraXp / 30000)
  return { lv: 30 + extraLv, xpInLevel: extraXp % 30000, xpForNext: 30000 }
}

export const TITLES = [
  { id: 'first_step',   Icon: IconFirstStep,   name: '첫 발걸음',    desc: '첫 스테이지 클리어',   condition: (u) => (u?.completed_stages || 0) >= 1 },
  { id: 'streak_7',     Icon: IconStreak,       name: '연속학습자',   desc: '7일 스트릭 달성',      condition: (u) => (u?.streak || 0) >= 7 },
  { id: 'boss_slayer',  Icon: IconBossSlayer,   name: '보스슬레이어', desc: '첫 보스 클리어',       condition: (u) => (u?.boss_cleared || 0) >= 1 },
  { id: 'ai_explorer',  Icon: IconAiExplorer,   name: 'AI 탐구자',    desc: 'AI 피드백 10회 확인',  condition: (u) => (u?.ai_feedback_count || 0) >= 10 },
  { id: 'unit_master',  Icon: IconUnitMaster,   name: '유닛 마스터',  desc: '유닛 1개 100% 완료',   condition: (u) => (u?.completed_units || 0) >= 1 },
  { id: 'aimon_master', Icon: IconAimonMaster,  name: '에이몬 마스터',desc: 'Lv.30 달성',           condition: (u) => calcLevel(u?.xp || 0).lv >= 30 },
  { id: 'rookie_coder', Icon: IconUnitMaster,   name: '코드 ROOKIE',  desc: '초급 엔드보스 클리어', condition: (u) => u?.titles?.includes('rookie_coder') },
  { id: 'ace_coder',    Icon: IconUnitMaster,   name: 'ACE 코더',     desc: '중급 엔드보스 클리어', condition: (u) => u?.titles?.includes('ace_coder') },
  { id: 'ai_master',    Icon: IconAimonMaster,  name: 'AI 마스터',    desc: '고급 엔드보스 클리어', condition: (u) => u?.titles?.includes('ai_master') },
]

export const CHARACTERS = [
  { id: 'slime',         icon: '/src/assets/character_slime.png',      name: '에이원', desc: '기본 캐릭터',         requiredLevel: null },
  { id: 'robot',         icon: '/src/assets/character_robot.png',       name: '에이량',   desc: '초급 클리어 시 해금', requiredLevel: 'beginner' },
  { id: 'speech_bubble', icon: '/src/assets/character_bubble.png',      name: '에이훈', desc: '중급 클리어 시 해금', requiredLevel: 'intermediate' },
  { id: 'final_ghost',   icon: '/src/assets/character_final_ghost.png', name: '에이왕', desc: '고급 클리어 시 해금', requiredLevel: 'advanced' },
]


export const CHAR_ICONS = Object.fromEntries(CHARACTERS.map(c => [c.id, c.icon]))

// 인증카드 색상 테마
export const CERT_THEMES = [
  { grad: 'linear-gradient(135deg,#378ADD,#185FA5)', bodyBg: '#E6F1FB', footerBg: '#185FA5', label: 'Unit 1 보스' },
  { grad: 'linear-gradient(135deg,#1D9E75,#085041)', bodyBg: '#E1F5EE', footerBg: '#085041', label: 'Unit 2 보스' },
  { grad: 'linear-gradient(135deg,#7F77DD,#26215C)', bodyBg: '#EEEDFE', footerBg: '#26215C', label: 'Unit 3 보스' },
  { grad: 'linear-gradient(135deg,#854F0B,#412402)', bodyBg: '#FAEEDA', footerBg: '#412402', label: 'Unit 4 보스' },
]

// 칭호별 아이콘 배경색
export const TITLE_ICON_BG = {
  first_step:   { bg: 'rgba(255,255,255,0.06)', color: '#4ADE80' },
  streak_7:     { bg: 'rgba(251,146,60,0.15)',  color: '#FB923C' },
  boss_slayer:  { bg: 'rgba(129,140,248,0.15)', color: '#818CF8' },
  ai_explorer:  { bg: 'rgba(127,119,221,0.2)',  color: '#9B94E8' },
  unit_master:  { bg: 'rgba(251,191,36,0.15)',  color: '#FBBF24' },
  aimon_master: { bg: 'rgba(56,189,248,0.15)',  color: '#38BDF8' },
  rookie_coder: { bg: 'rgba(251,191,36,0.15)',  color: '#FBBF24' },
  ace_coder:    { bg: 'rgba(251,191,36,0.15)',  color: '#FBBF24' },
  ai_master:    { bg: 'rgba(56,189,248,0.15)',  color: '#38BDF8' },
}
