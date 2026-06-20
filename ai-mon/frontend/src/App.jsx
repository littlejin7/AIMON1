import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar/NavBar";
import Home from "./pages/Home/Home";
import LessonHome from "./pages/Lesson/LessonHome";
import Lesson from "./pages/Lesson/Lesson";
import Stage from "./pages/Stage/Stage";
import Boss from "./pages/Boss/Boss";
import EndBoss from "./pages/EndBoss/EndBoss";
import BossSelect from "./pages/Boss/BossSelect";
import Character from "./pages/Character/Character";
import Settings from "./pages/Settings/Settings";
import Train from "./pages/Train/Train";
import Auth from "./pages/Auth/Auth";
import SocialCallback from "./pages/Auth/SocialCallback";
import NaverCallback from "./pages/Auth/NaverCallback";
import KakaoCallback from "./pages/Auth/KakaoCallback";
import LevelTestInfo from "./pages/LevelTestInfo/LevelTestInfo";
import { useAuthStore } from "./hooks/useAuthStore";
import SplashLoading from "./components/loading/SplashLoading";
import TopBar from "./components/TopBar/TopBar";
import Game from "./pages/Game/Game";
import Aipang from "./pages/Game/Aipang/Aipang";
import RunnerGame from "./pages/Game/AIrun/index";
import AIbomb from "./pages/Game/AIbomb/AIbomb";
import AIPair from "./pages/Game/AIPair/AIPair";
// 앱 시작 시 Pyodide를 백그라운드에서 미리 로드 (code_input 문제 대비)
// App.jsx 내의 useEffect에서 처리하도록 이동되었습니다.

/** 로그인 필수 경로 */
function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/" replace />;
}

/** NavBar가 포함된 공통 레이아웃 */
function AppLayout({ children }) {
  return (
    <div className="page">
      <TopBar />
      {children}
      <NavBar />
    </div>
  );
}

export default function App() {
  const theme = useAuthStore((s) => s.theme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme || "dark");
  }, [theme]);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkAndLoad = () => {
      if (
        typeof window !== "undefined" &&
        window.loadPyodide &&
        !window.__pyodidePreload
      ) {
        window.__pyodidePreload = window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
        });
      }
    };
    checkAndLoad();
    if (typeof window !== "undefined" && !window.loadPyodide) {
      const interval = setInterval(() => {
        if (window.loadPyodide) {
          checkAndLoad();
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  if (!ready) return <SplashLoading />;

  return (
    <BrowserRouter>
      <Routes>
        {/* ── 인증 페이지 (NavBar 없음) ── */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback/google" element={<SocialCallback />} />
        <Route path="/auth/callback/naver" element={<NaverCallback />} />
        <Route path="/auth/callback/kakao" element={<KakaoCallback />} />

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

        {/* 보스 선택 화면 */}
        <Route
          path="/boss"
          element={
            <ProtectedRoute>
              <AppLayout>
                <BossSelect />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 엔드보스 전투 */}
        <Route
          path="/boss/endboss"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EndBoss />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 유닛보스 전투 */}
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
            <AppLayout>
              <Train />
            </AppLayout>
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

        {/* 미니게임 */}
        <Route
          path="/game"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Game />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* 타임킬링 (AI팡 퍼즐) — 전체화면, NavBar 없음 */}
        <Route
          path="/game/aipang"
          element={
            <ProtectedRoute>
              <Aipang />
            </ProtectedRoute>
          }
        />

        {/* 파이썬 런너 (3D OX 달리기 게임) — 전체화면, NavBar 없음 */}
        <Route
          path="/game/runner"
          element={
            <ProtectedRoute>
              <RunnerGame />
            </ProtectedRoute>
          }
        />

        {/* AI 폭탄 해제 */}
        <Route
          path="/game/aibomb"
          element={
            <ProtectedRoute>
              <AIbomb />
            </ProtectedRoute>
          }
        />

        <Route
          path="/game/pairs"
          element={
            <ProtectedRoute>
              <AIPair />
            </ProtectedRoute>
          }
        />

        {/* 그 외 경로 → 레슨 홈 */}
        <Route path="*" element={<Navigate to="/lesson" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
