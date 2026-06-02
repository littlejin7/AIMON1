import api from './client'

export const authApi = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
}

export const quizApi = {
  getLessons:      ()           => api.get('/quiz/lessons'),
  getLesson:       (id)         => api.get(`/quiz/lessons/${id}`),
  getQuestions:    (params)     => api.get('/quiz/questions', { params }),
  getQuestion:     (id)         => api.get(`/quiz/questions/${id}`),
}

export const progressApi = {
  getProgress: ()     => api.get('/progress/'),
  getStats:    ()     => api.get('/progress/stats'),
  saveProgress:(data) => api.post('/progress/', data),
}

export const bossApi = {
  getQuestion:   ()     => api.get('/boss/question'),
  submitAnswer:  (data) => api.post('/boss/answer', data),
}

export const codeApi = {
  runCode: (data) => api.post('/code/run', data),
}

export const userApi = {
  getMe:    ()     => api.get('/user/me'),
  updateMe: (data) => api.patch('/user/me', data),
}
