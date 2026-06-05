/**
 * usePyodide — 브라우저 내 Python 코드 실행 훅
 * Pyodide는 index.html의 CDN 스크립트로 전역에 로드됩니다.
 * 최초 호출 시 1회만 초기화하고, 이후에는 캐시된 인스턴스를 재사용합니다.
 */
import { useState, useCallback } from 'react'

// 모듈 수준에서 인스턴스를 캐시 (컴포넌트 언마운트 후에도 유지)
let _pyodide = null
let _initPromise = null

async function initPyodide() {
  if (_pyodide) return _pyodide
  if (!_initPromise) {
    // App.jsx에서 미리 시작한 preload 프로미스가 있으면 그것을 재사용
    _initPromise = window.__pyodidePreload || window.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
    })
  }
  _pyodide = await _initPromise
  return _pyodide
}

export function usePyodide() {
  const [pyLoading, setPyLoading] = useState(false)

  /**
   * Python 코드를 실행하고 결과를 반환합니다.
   * @param {string} code - 실행할 Python 코드
   * @returns {{ stdout: string, stderr: string, success: boolean }}
   */
  const runPython = useCallback(async (code) => {
    setPyLoading(true)
    try {
      const py = await initPyodide()

      // stdout 캡처
      let stdout = ''
      py.setStdout({
        batched: (text) => {
          stdout += text
        },
      })

      try {
        await py.runPythonAsync(code)
        return { stdout: stdout.trimEnd(), stderr: '', success: true }
      } catch (err) {
        // PythonError (SyntaxError, NameError 등)
        return { stdout: '', stderr: String(err.message || err), success: false }
      }
    } catch (err) {
      // Pyodide 로드 실패
      return { stdout: '', stderr: `Pyodide 로드 실패: ${err.message}`, success: false }
    } finally {
      setPyLoading(false)
    }
  }, [])

  return { runPython, pyLoading }
}
