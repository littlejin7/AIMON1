import api from './client'

export const authApi = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  checkId: (username) => api.get(`/auth/check-id?username=${encodeURIComponent(username)}`),
}

export const quizApi = {
  // 유닛 목록 (lessons.json)
  getUnits:        ()           => api.get('/quiz/units'),
  getUnit:         (unitId)     => api.get(`/quiz/units/${unitId}`),
  // 브리핑 슬라이드 (lessons/ 폴더)
  getLessons:      ()           => api.get('/quiz/lessons'),
  getLesson:       (lessonId)   => api.get(`/quiz/lessons/${lessonId}`),
  // 퀴즈 문제
  getQuestions:    (params)     => api.get('/quiz/questions', { params }),
  getQuestion:     (id)         => api.get(`/quiz/questions/${id}`),
  getAiFeedback:   (data)       => api.post('/quiz/ai-feedback', data),
}

export const progressApi = {
  getProgress: ()     => api.get('/progress/'),
  getStats:    ()     => api.get('/progress/stats'),
  saveProgress:(data) => api.post('/progress/', data),
}

export const bossApi = {
  getInfo:       (unit) => api.get(`/boss/info?unit=${unit}`),
  startBattle:   (unit) => api.post(`/boss/start?unit=${unit}`),
  nextQuestion:  (unit) => api.post(`/boss/next?unit=${unit}`),
  submitAnswer:  (data) => api.post('/boss/answer', data),
}

export const codeApi = {
  runCode: (data) => api.post('/code/run', data),
}

export const userApi = {
  getMe:    ()     => api.get('/user/me'),
  updateMe: (data) => api.patch('/user/me', data),
}

export const trainApi = {
  getReview: (params) => api.get('/train/review', { params }),
}
