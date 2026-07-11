const INSTALL_STATE_EVENT = 'aimon:pwa-install-state-change'
const DISMISS_STORAGE_KEY = 'aimon:pwa-install-dismiss'

let deferredInstallPrompt = null
let initialized = false

function emitInstallStateChange() {
  window.dispatchEvent(new Event(INSTALL_STATE_EVENT))
}

function readDismissState() {
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : { count: 0, nextPromptAt: 0, disabled: false }
  } catch {
    return { count: 0, nextPromptAt: 0, disabled: false }
  }
}

function writeDismissState(state) {
  window.localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(state))
}

function clearDismissState() {
  window.localStorage.removeItem(DISMISS_STORAGE_KEY)
}

export function isPwaInstalled() {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  )
}

export function initPwaInstallPrompt() {
  if (typeof window === 'undefined' || initialized) return
  initialized = true

  window.addEventListener('beforeinstallprompt', (event) => {
    if (isPwaInstalled()) return

    // Keep Chrome's default mini install banner available on Android.
    deferredInstallPrompt = event
    emitInstallStateChange()
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    clearDismissState()
    emitInstallStateChange()
  })
}

export function subscribePwaInstallState(callback) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener(INSTALL_STATE_EVENT, callback)
  return () => window.removeEventListener(INSTALL_STATE_EVENT, callback)
}

export function canPromptPwaInstall() {
  if (typeof window === 'undefined') return false
  return !isPwaInstalled() && !!deferredInstallPrompt
}

export function getPwaInstallStatus() {
  if (typeof window === 'undefined') {
    return { installed: false, canPrompt: false, canInstallManually: false }
  }

  const installed = isPwaInstalled()
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent || '')

  return {
    installed,
    canPrompt: !installed && !!deferredInstallPrompt,
    canInstallManually: !installed && !deferredInstallPrompt && isIos,
  }
}

export function canShowPostSignupInstallPrompt() {
  if (typeof window === 'undefined') return false
  if (isPwaInstalled() || !deferredInstallPrompt) return false

  const dismissState = readDismissState()
  if (dismissState.disabled) return false
  if (dismissState.nextPromptAt && Date.now() < dismissState.nextPromptAt) return false

  return true
}

export function recordPostSignupInstallDismissal() {
  if (typeof window === 'undefined') return

  const previous = readDismissState()
  const count = (previous.count || 0) + 1

  if (count >= 3) {
    writeDismissState({ count, nextPromptAt: 0, disabled: true })
    emitInstallStateChange()
    return
  }

  const cooldownDays = count === 1 ? 7 : 30
  writeDismissState({
    count,
    nextPromptAt: Date.now() + cooldownDays * 24 * 60 * 60 * 1000,
    disabled: false,
  })
  emitInstallStateChange()
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt || isPwaInstalled()) {
    return { outcome: 'unavailable' }
  }

  const promptEvent = deferredInstallPrompt
  deferredInstallPrompt = null
  emitInstallStateChange()

  try {
    const result = await promptEvent.prompt()
    if (result?.outcome === 'accepted') {
      clearDismissState()
    }
    return result || { outcome: 'unknown' }
  } catch {
    return { outcome: 'unavailable' }
  }
}

export async function reloadAppFromNetwork() {
  if (typeof window === 'undefined') return

  try {
    if ('serviceWorker' in window.navigator) {
      const registrations = await window.navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.update().catch(() => null)))

      registrations.forEach((registration) => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      })
    }
  } catch {
    // A stale app should still be reloadable even if service worker update checks fail.
  }

  try {
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys()
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)))
    }
  } catch {
    // Cache deletion is a best-effort update helper, not a blocking requirement.
  }

  window.location.reload()
}
