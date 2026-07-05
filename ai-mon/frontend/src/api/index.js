import api, { logApiError, requireAuthToken } from './client'

export const authApi = {
  login:    (data, cfg) => api.post('/auth/login', data, cfg),
  register: (data) => api.post('/auth/register', data),
  checkId: (username) => api.get(`/auth/check-id?username=${encodeURIComponent(username)}`),
  checkEmail: (email) => api.get(`/auth/check-email?email=${encodeURIComponent(email)}`),
  socialLoginGoogle: (data) => api.post('/auth/social/google', data),
  socialLoginNaver: (data) => api.post('/auth/social/naver', data),
  socialLoginKakao: (data) => api.post('/auth/social/kakao', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword:  (data) => api.post('/auth/reset-password', data),
  findId: (data) => api.post('/auth/find-id', data),
  submitLevelTest: (data) => api.post('/auth/level-test/submit', data),
  touch:           ()     => api.post('/auth/touch'),
}

export const quizApi = {
  // 유닛 목록 (lessons.json)
  getUnits:        (courseLevel)         => api.get('/quiz/units', { params: { course_level: courseLevel } }),
  getUnit:         (unitId, courseLevel) => api.get(`/quiz/units/${unitId}`, { params: { course_level: courseLevel } }),
  // 브리핑 슬라이드 (lessons/ 폴더)
  getLessons:      ()           => api.get('/quiz/lessons'),
  getLesson: (lessonId, courseLevel) => api.get(`/quiz/lessons/${lessonId}`, { params: { course_level: courseLevel } }),
  // 퀴즈 문제
  getQuestions:    (params)     => api.get('/quiz/questions', { params }),
  getQuestion:     (id)         => api.get(`/quiz/questions/${id}`),
  getAiFeedback:   (data, config) => api.post('/quiz/ai-feedback', data, config),
}

export const progressApi = {
  getProgress: (courseLevel) => {
    requireAuthToken('GET /progress/')
    return api.get('/progress/', { params: { course_level: courseLevel } })
  },
  getStats:    ()     => {
    requireAuthToken('GET /progress/stats')
    return api.get('/progress/stats')
  },
  saveProgress:(data) => {
    requireAuthToken('POST /progress/')
    return api.post('/progress/', data)
  },
}

export const bossApi = {
  getInfo:       (unit) => {
    requireAuthToken('GET /boss/info')
    return api.get(`/boss/info?unit=${unit}`)
  },
  startBattle:   (unit) => {
    requireAuthToken('POST /boss/start')
    return api.post(`/boss/start?unit=${unit}`)
  },
  nextQuestion:  (unit, battleToken = '') => {
    requireAuthToken('POST /boss/next')
    const tokenParam = battleToken ? `&battle_token=${encodeURIComponent(battleToken)}` : ''
    return api.post(`/boss/next?unit=${unit}${tokenParam}`)
  },
  submitAnswer:  (data) => {
    requireAuthToken('POST /boss/answer')
    return api.post('/boss/answer', data)
  },
  getHint:       (data) => {
    requireAuthToken('POST /boss/hint')
    return api.post('/boss/hint', data)
  },
}

export const endbossApi = {
  getInfo:       (targetLevel)        => api.get('/boss/endboss/info', { params: targetLevel ? { target_level: targetLevel } : {} }),
  startBattle:   (project, targetLevel) => api.post('/boss/endboss/start', { project, ...(targetLevel && { target_level: targetLevel }) }),
  submitAnswer:  (data)                => api.post('/boss/endboss/answer', data),
  clearBoss:     (project, targetLevel) => api.post('/boss/endboss/clear', { project, ...(targetLevel && { target_level: targetLevel }) }),
}

export const minibossApi = {
  getInfo:       () => {
    requireAuthToken('GET /boss/miniboss/info')
    return api.get('/boss/miniboss/info')
  },
  startBattle:   (unit, stage, attempt = 1) => {
    requireAuthToken('POST /boss/miniboss/start')
    return api.post(`/boss/miniboss/start?unit=${unit}&stage=${stage}&attempt=${attempt}`)
  },
  submitAnswer:  (data) => {
    requireAuthToken('POST /boss/miniboss/answer')
    return api.post('/boss/miniboss/answer', data)
  },
  clearBoss:     (data) => {
    requireAuthToken('POST /boss/miniboss/clear')
    return api.post('/boss/miniboss/clear', data)
  },
}

export const codeApi = {
  // 채점 단일 소스. body: { question_id, code, output, error, unit, stage, course_level, award }
  // award=false 면 백엔드가 채점 결과(is_correct/score/feedback)만 반환(XP·진행도 미저장).
  submitCode: (data) => api.post('/code/submit', data),
  getHint:    (data) => api.post('/code/hint',   data),
}

export const userApi = {
  getMe:         ()        => api.get('/user/me'),
  updateMe:      (data)    => api.patch('/user/me', data),
  purchaseTheme: (themeId) => api.post('/user/purchase-theme', { theme_id: themeId }),
  deleteMe:      ()        => api.delete('/user/me'),
}

export const trainApi = {
  getReview:      (params)      => api.get('/train/review',      { params }),
  getRandom:      (params)      => api.get('/train/random',      { params }),
  getBossRush:    (params)      => api.get('/train/boss_rush',   { params }),
  getAccuracy:    (courseLevel) => api.get('/train/accuracy',    { params: { course_level: courseLevel } }),
  updateReviewed: (data)        => api.post('/train/reviewed',   data),
}

export const attemptsApi = {
  // 풀이 전수 기록 (정오답 무관). 채점 순간 fire-and-forget 로 호출.
  record: async (data) => {
    try {
      return await api.post('/attempts', data)
    } catch (err) {
      logApiError('POST /attempts failed without blocking UI', err)
      return {
        data: {
          success: false,
          is_correct: !!data?.is_correct,
          feedback: '',
          hint: '',
          correct_answer: '',
          attempt_record_failed: true,
        },
      }
    }
  },
}

export const gameApi = {
  startGame: (gameId) => api.post('/game/start', { game_id: gameId }),
  clearGame: (data)   => api.post('/game/clear', data),
  ranking:        (limit = 3) => api.get('/game/ranking',         { params: { limit } }),
  rankingByGame:  (limit = 3) => api.get('/game/ranking/by-game', { params: { limit } }),

  // aicross 전용 helper. 서버가 정답 필드 없는 public puzzle 을 내려주고(start),
  // clear 시 answers 를 서버에서 재채점한다(entry/cell 단위 모두 지원).
  startAicross: () => api.post('/game/start', { game_id: 'aicross' }),
  clearAicross: ({ gameToken, puzzleId, answers, score = 0 }) =>
    api.post('/game/clear', {
      game_id: 'aicross',
      game_token: gameToken,
      puzzle_id: puzzleId,
      answers,
      score,
    }),
}

export const missionApi = {
  getMissions:  ()          => api.get('/missions/'),
  claimMission: (missionId) => api.post('/missions/claim', { mission_id: missionId }),
}
