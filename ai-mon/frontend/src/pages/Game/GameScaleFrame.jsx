import { useEffect, useState } from 'react'

const BASE_WIDTH = 480
const BASE_HEIGHT = 852

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: BASE_WIDTH, height: BASE_HEIGHT }
  }

  return {
    width: window.visualViewport?.width || window.innerWidth || BASE_WIDTH,
    height: window.visualViewport?.height || window.innerHeight || BASE_HEIGHT,
  }
}

export default function GameScaleFrame({
  children,
  baseWidth = BASE_WIDTH,
  baseHeight = BASE_HEIGHT,
  background = 'var(--clr-bg)',
  frameOverflow = 'hidden',
  scaleMode = 'fit',
}) {
  const [metrics, setMetrics] = useState({ scale: 1, frameHeight: baseHeight })

  const hasFixedHeight = typeof baseHeight === 'number'

  useEffect(() => {
    const updateScale = () => {
      const { width, height } = getViewportSize()
      const widthScale = Math.min(width / baseWidth, 1)
      const heightScale = hasFixedHeight ? height / baseHeight : 1

      if (scaleMode === 'fill-height' && hasFixedHeight) {
        const nextScale = widthScale
        setMetrics({
          scale: nextScale,
          frameHeight: Math.max(baseHeight, height / Math.max(nextScale, 0.001)),
        })
        return
      }

      setMetrics({
        scale: Math.min(widthScale, scaleMode === 'width' ? 1 : heightScale, 1),
        frameHeight: baseHeight,
      })
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    window.visualViewport?.addEventListener('resize', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      window.visualViewport?.removeEventListener('resize', updateScale)
    }
  }, [baseHeight, baseWidth, hasFixedHeight, scaleMode])

  return (
    <div
      className="game-scale-shell"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowX: 'hidden',
        overflowY: hasFixedHeight ? 'hidden' : 'auto',
        background,
      }}
    >
      <div
        className="game-scale-frame"
        style={{
          position: 'relative',
          width: `${baseWidth}px`,
          height: hasFixedHeight ? `${metrics.frameHeight}px` : 'auto',
          minHeight: hasFixedHeight ? undefined : '100%',
          flexShrink: 0,
          overflow: frameOverflow,
          transform: `scale(${metrics.scale})`,
          transformOrigin: 'top center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
