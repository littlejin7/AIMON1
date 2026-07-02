import { useState, useEffect } from 'react'
import './LevelTestModal.css'

const STEPS = [
  '답변 데이터 수집 완료',
  '난이도별 정답률 계산 완료',
  '영역별 강약점 분석 중...',
  '최적 에이몬 결정',
  '맞춤형 커리큘럼 생성',
]

export default function LevelTestLoading() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setProgress(p => Math.min(p + 1, STEPS.length)), 480)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '20px', padding: '40px 24px 36px', textAlign: 'center',
    }}>
      {/* 스피너 */}
      <div style={{ position: 'relative', width: '90px', height: '90px' }}>
        <div
          className="lt-spin"
          style={{
            width: '90px', height: '90px', borderRadius: '50%',
            border: '5px solid #EEEDFE', borderTopColor: '#7F77DD',
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px',
        }}>
          🔍
        </div>
      </div>

      <div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#26215C' }}>분석하는 중이에요</div>
        <div style={{ fontSize: '13px', color: '#9B96D0', marginTop: '5px' }}>잠깐만 기다려주세요...</div>
      </div>

      {/* 단계 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', width: '100%' }}>
        {STEPS.map((text, i) => {
          const state = i < progress ? 'done' : i === progress ? 'doing' : 'todo'
          const styleMap = {
            done:  { background: '#F0FFF4', color: '#166534' },
            doing: { background: '#F0EFFE', color: '#534AB7' },
            todo:  { background: '#FAFAFA', color: '#C4BFEE' },
          }
          const icon = state === 'done' ? '✅' : state === 'doing' ? '⏳' : '⬜'
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '12px',
                fontSize: '12px', fontWeight: 500,
                transition: 'all .3s',
                ...styleMap[state],
              }}
            >
              <span style={{ fontSize: '15px', width: '20px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
              <span>{text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
