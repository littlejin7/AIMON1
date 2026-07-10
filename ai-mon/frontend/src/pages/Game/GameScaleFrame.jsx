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
  background = '#F4F3FA',
  frameOverflow = 'hidden',
  scaleMode = 'fit',
}) {
  const [scale, setScale] = useState(1)

  const hasFixedHeight = typeof baseHeight === 'number'

  useEffect(() => {
    const updateScale = () => {
      const { width, height } = getViewportSize()
      const widthScale = width / baseWidth
      const heightScale = hasFixedHeight ? height / baseHeight : 1
      setScale(Math.min(widthScale, scaleMode === 'width' ? 1 : heightScale, 1))
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
        alignItems: hasFixedHeight ? 'center' : 'flex-start',
        justifyContent: 'center',
        overflow: hasFixedHeight ? 'hidden' : 'auto',
        background,
      }}
    >
      <div
        className="game-scale-frame"
        style={{
          position: 'relative',
          width: `${baseWidth}px`,
          height: hasFixedHeight ? `${baseHeight}px` : 'auto',
          minHeight: hasFixedHeight ? undefined : '100%',
          flexShrink: 0,
          overflow: frameOverflow,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
