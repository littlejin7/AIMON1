const KNOWN_IN_APP_PATTERNS = [
  { pattern: /NAVER/i, appName: '네이버' },
  { pattern: /KAKAOTALK/i, appName: '카카오톡' },
  { pattern: /Instagram/i, appName: '인스타그램' },
  { pattern: /\bFBAN\b|\bFBAV\b/i, appName: 'Facebook' },
  { pattern: /Line\//i, appName: 'LINE' },
  { pattern: /DaumApps/i, appName: 'Daum' },
]

const IOS_EXTERNAL_BROWSER_PATTERN = /Safari|CriOS|FxiOS|EdgiOS|OPiOS/i

export function detectInAppBrowser(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
) {
  const ua = String(userAgent || '')
  const platform = /Android/i.test(ua)
    ? 'android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'ios'
      : 'other'

  const knownApp = KNOWN_IN_APP_PATTERNS.find(({ pattern }) => pattern.test(ua))
  if (knownApp) {
    return {
      isInApp: true,
      appName: knownApp.appName,
      platform,
    }
  }

  const isAndroidWebView = platform === 'android' && (
    /;\s*wv[);]/i.test(ua) ||
    (/Version\/4\.0/i.test(ua) && !/Firefox|FxiOS|EdgA|EdgiOS/i.test(ua))
  )

  if (isAndroidWebView) {
    return {
      isInApp: true,
      appName: null,
      platform,
    }
  }

  const isIOSWebView = platform === 'ios' &&
    /AppleWebKit/i.test(ua) &&
    !IOS_EXTERNAL_BROWSER_PATTERN.test(ua)

  return {
    isInApp: isIOSWebView,
    appName: null,
    platform,
  }
}
