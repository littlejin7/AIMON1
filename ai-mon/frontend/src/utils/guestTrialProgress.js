const GUEST_TRIAL_PROGRESS_KEY = 'aimon-guest-trial-progress'

export function saveGuestTrialProgress(progress) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GUEST_TRIAL_PROGRESS_KEY, JSON.stringify(progress))
}

export function readGuestTrialProgress() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(GUEST_TRIAL_PROGRESS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearGuestTrialProgress() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(GUEST_TRIAL_PROGRESS_KEY)
}
