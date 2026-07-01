import axios from 'axios'
import { useAuthStore } from '../hooks/useAuthStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 15000,
})

export function getApiErrorInfo(error) {
  const config = error?.config || {}
  return {
    method: config.method?.toUpperCase(),
    url: config.url,
    status: error?.response?.status ?? null,
    detail: error?.response?.data?.detail ?? error?.response?.data ?? null,
    message: error?.message || 'Unknown API error',
  }
}

export function logApiError(label, error) {
  if (error?.__aimonLogged) return
  Object.defineProperty(error, '__aimonLogged', {
    value: true,
    configurable: true,
  })
  console.error(`[API] ${label}`, getApiErrorInfo(error))
}

export function requireAuthToken(label = 'authenticated request') {
  const token = useAuthStore.getState().token
  if (token) return token

  const error = new Error('Login required')
  error.response = {
    status: 401,
    data: { detail: '로그인이 필요합니다.' },
  }
  error.config = { url: label }
  logApiError(label, error)
  throw error
}

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally with automatic token refresh
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config

    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      const { refreshToken, setAuth, logout } = useAuthStore.getState()

      if (refreshToken) {
        try {
          // Use raw axios to prevent request interceptor loop
          const response = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refresh_token: refreshToken }
          )

          const { access_token, refresh_token: new_refresh_token } = response.data
          setAuth(access_token, useAuthStore.getState().user, new_refresh_token)

          processQueue(null, access_token)
          isRefreshing = false

          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        } catch (refreshError) {
          processQueue(refreshError, null)
          isRefreshing = false
          logout()
          logApiError('token refresh failed', refreshError)
          return Promise.reject(refreshError)
        }
      } else {
        processQueue(err, null)
        isRefreshing = false
        logout()
      }
    }

    logApiError('request failed', err)
    return Promise.reject(err)
  }
)

export default api
