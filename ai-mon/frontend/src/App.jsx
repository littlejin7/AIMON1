import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import NavBar from './components/NavBar/NavBar'
import Home from './pages/Home/Home'
import LessonHome from './pages/Lesson/LessonHome'
import Lesson from './pages/Lesson/Lesson'
import Stage from './pages/Stage/Stage'
import Boss from './pages/Boss/Boss'
import Character from './pages/Character/Character'
import Settings from './pages/Settings/Settings'
import Train from './pages/Train/Train'
import Auth from './pages/Auth/Auth'
import LevelTestInfo from './pages/LevelTestInfo/LevelTestInfo'
import { useAuthStore } from './hooks/useAuthStore'

// 앱 시작 시 Pyodide를 백그라운드에서 미리 로드 (code_input 문제 대비)
if (typeof window !== 'undefined' && window.loadPyodide) {
  window.__pyodidePreload = window.loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
  })
}

/** 로그인 필수 경로 */
function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/" replace />
}

/** NavBar가 포함된 공통 레이아웃 */
function AppLayout({ children }) {
  return (
    <div className="page">
      {children}
      <NavBar />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── 인증 페이지 (NavBar 없음) ── */}
        <Route path="/auth" element={<Auth />} />

        {/* ── Public Routes: 비로그인 접근 가능 ── */}

        {/* 홈 대시보드: 비로그인 랜딩 / 로그인 대시보드 */}
        <Route
          path="/"
          element={
            <AppLayout>
              <Home />
            </AppLayout>
          }
        />

        {/* 레슨 홈: 유닛 목록 (비로그인 시 Unit1만 열려 있음) */}
        <Route
          path="/lesson"
          element={
            <AppLayout>
              <LessonHome />
            </AppLayout>
          }
        />

        {/* 1-1 스테이지: 비로그인 선체험 허용 */}
        <Route
          path="/stage/1/1"
          element={
            <AppLayout>
              <Stage _lessonId="1" _stage="1" />
            </AppLayout>
          }
        />

        {/* 레벨 테스트 안내 페이지 (비로그인 전용 제한 설명) */}
        <Route
          path="/level-test-info"
          element={
            <AppLayout>
              <LevelTestInfo />
            </AppLayout>
          }
        />

        {/* ── Private Routes: 로그인 필수 ── */}

        {/* 유닛 상세 (스테이지 목록) */}
        <Route
          path="/lesson/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Lesson />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 스테이지 퀴즈 (1-1 제외한 모든 스테이지) */}
        <Route
          path="/stage/:lessonId/:stage"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Stage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 파이널 보스 (준비중) */}
        <Route
          path="/boss/final"
          element={
            <ProtectedRoute>
              <AppLayout>
                <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--clr-text-muted)' }}>
                  <h2>👿 파이널 보스</h2>
                  <p>Unit 8까지 모두 완료하면 해금됩니다!</p>
                </div>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 보스 전투 */}
        <Route
          path="/boss/:lessonId"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Boss />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 훈련 탭 */}
        <Route
          path="/train"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Train />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 내 캐릭터 */}
        <Route
          path="/character"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Character />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 설정 */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 미니게임 (준비중) */}
        <Route
          path="/game"
          element={
            <ProtectedRoute>
              <AppLayout>
                <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--clr-text-muted)' }}>
                  <h2>🎮 미니게임 탭</h2>
                  <p>곧 재미있는 미니게임이 추가될 예정입니다!</p>
                </div>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 그 외 경로 → 레슨 홈 */}
        <Route path="*" element={<Navigate to="/lesson" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
