import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import NavBar from './components/NavBar/NavBar'
import Home from './pages/Home/Home'
import Lesson from './pages/Lesson/Lesson'
import Stage from './pages/Stage/Stage'
import Boss from './pages/Boss/Boss'
import Character from './pages/Character/Character'
import Settings from './pages/Settings/Settings'
import Auth from './pages/Auth/Auth'
import { useAuthStore } from './hooks/useAuthStore'

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/auth" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 인증 페이지 */}
        <Route path="/auth" element={<Auth />} />

        {/* Public Routes: 비로그인 선체험 허용 (홈, 1-1 스테이지) */}
        <Route
          path="/"
          element={
            <div className="page">
              <Home />
              <NavBar />
            </div>
          }
        />
        <Route
          path="/stage/1/1"
          element={
            <div className="page">
              <Stage />
            </div>
          }
        />

        {/* Private Routes: 로그인 필수 */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="page">
                <Routes>
                  <Route path="/lesson/:id"                element={<Lesson />} />
                  <Route path="/stage/:lessonId/:stage"    element={<Stage />} />
                  <Route path="/boss/:lessonId"            element={<Boss />} />
                  <Route path="/character"                 element={<Character />} />
                  <Route path="/settings"                  element={<Settings />} />
                </Routes>
                <NavBar />
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
