import api from './client'

export const authApi = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  checkId: (username) => api.get(`/auth/check-id?username=${encodeURIComponent(username)}`),
  checkEmail: (email) => api.get(`/auth/check-email?email=${encodeURIComponent(email)}`),
  socialLoginGoogle: (data) => api.post('/auth/social/google', data),
  socialLoginNaver: (data) => api.post('/auth/social/naver', data),
  socialLoginKakao: (data) => api.post('/auth/social/kakao', data),
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
  getProgress: (courseLevel) => api.get('/progress/', { params: { course_level: courseLevel } }),
  getStats:    ()     => api.get('/progress/stats'),
  saveProgress:(data) => api.post('/progress/', data),
}

export const bossApi = {
  getInfo:       (unit) => api.get(`/boss/info?unit=${unit}`),
  startBattle:   (unit) => api.post(`/boss/start?unit=${unit}`),
  nextQuestion:  (unit) => api.post(`/boss/next?unit=${unit}`),
  submitAnswer:  (data) => api.post('/boss/answer', data),
  getHint:       (data) => api.post('/boss/hint', data),
}

export const endbossApi = {
  getInfo:       ()         => api.get('/boss/endboss/info'),
  startBattle:   (project)  => api.post('/boss/endboss/start', { project }),
  submitAnswer:  (data)     => api.post('/boss/endboss/answer', data),
  clearBoss:     (project)  => api.post('/boss/endboss/clear', { project }),
}

export const minibossApi = {
  getInfo:       () => api.get('/boss/miniboss/info'),
  startBattle:   (unit, stage) => api.post(`/boss/miniboss/start?unit=${unit}&stage=${stage}`),
  submitAnswer:  (data) => api.post('/boss/miniboss/answer', data),
  clearBoss:     (data) => api.post('/boss/miniboss/clear', data),
}

export const codeApi = {
  runCode: (data) => api.post('/code/run', data),
}

export const userApi = {
  getMe:         ()        => api.get('/user/me'),
  updateMe:      (data)    => api.patch('/user/me', data),
  purchaseTheme: (themeId) => api.post('/user/purchase-theme', { theme_id: themeId }),
}

export const trainApi = {
  getReview: (params) => api.get('/train/review', { params }),
  updateReviewed: (data) => api.post('/train/reviewed', data),
}

export const gameApi = {
  clearGame: (data) => api.post('/game/clear', data),
}
