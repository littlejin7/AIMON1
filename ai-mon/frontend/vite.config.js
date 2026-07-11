import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { execSync } from 'child_process'

const _appVersion = (() => {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim() }
  catch { return 'dev' }
})()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(_appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: '에이몬 (AI MON)',
        short_name: 'AI MON',
        description: '비전공자를 위한 AI 기반 코딩 학습 게임',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f0a1e',
        theme_color: '#7c3aed',
        orientation: 'portrait',
        icons: [
          {
            src: '/aimon-icon-192-v2.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/aimon-icon-512-v2.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/aimon-icon-maskable-512-v2.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  // 시작 시 핵심 의존성을 한 번에 사전번들링 → 로드 중 재최적화(503)로 인한 흰 화면 방지
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'zustand',
      'zustand/middleware',
      'axios',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@aipang': path.resolve(__dirname, './src/pages/Game/AipangPuzzle/assets'),
      'three/addons': path.resolve(__dirname, './node_modules/three/examples/jsm'),
    },
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

