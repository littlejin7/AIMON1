export default function LevelTestIntro({ onStart, onClose }) {
  return (
    <div>
      {/* ── 그라디언트 헤더 ── */}
      <div style={{
        background: 'linear-gradient(160deg,#F0EFFE 0%,#E4E0F8 100%)',
        padding: '16px 24px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '8px', textAlign: 'center',
        borderRadius: '24px 24px 0 0',
      }}>
        {/* 에이몬 캐릭터 SVG */}
        <svg width="64" height="64" viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="65" cy="118" rx="35" ry="8" fill="#CECBF6" opacity=".4"/>
          <ellipse cx="65" cy="64" rx="30" ry="30" fill="#9B94E8"/>
          <ellipse cx="65" cy="60" rx="28" ry="28" fill="#7F77DD"/>
          {/* 돋보기 */}
          <circle cx="65" cy="54" r="12" fill="none" stroke="white" strokeWidth="3"/>
          <line x1="73" y1="62" x2="80" y2="70" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          {/* 눈 */}
          <circle cx="53" cy="42" r="6" fill="white"/><circle cx="77" cy="42" r="6" fill="white"/>
          <circle cx="53" cy="43" r="3" fill="#26215C"/><circle cx="77" cy="43" r="3" fill="#26215C"/>
          <circle cx="54" cy="41" r="1.1" fill="white"/><circle cx="78" cy="41" r="1.1" fill="white"/>
          {/* 팔 */}
          <ellipse cx="33" cy="70" rx="9" ry="13" fill="#7F77DD" transform="rotate(-12 33 70)"/>
          <ellipse cx="97" cy="70" rx="9" ry="13" fill="#7F77DD" transform="rotate(12 97 70)"/>
          {/* 발 */}
          <ellipse cx="50" cy="100" rx="9" ry="6" fill="#534AB7"/>
          <ellipse cx="80" cy="100" rx="9" ry="6" fill="#534AB7"/>
        </svg>

        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#7F77DD', letterSpacing: '1px', marginBottom: '4px' }}>
            LEVEL TEST
          </div>
          <div style={{ fontSize: '19px', fontWeight: 700, color: '#26215C', lineHeight: 1.25 }}>
            나에게 딱 맞는 시작점 찾기
          </div>
          <div style={{ fontSize: '12px', color: '#9B96D0', marginTop: '5px', lineHeight: 1.5 }}>
            10문제 · 약 5분 소요 · Python 실력 분석
          </div>
        </div>
      </div>

      {/* ── 바디 ── */}
      <div style={{ padding: '12px 20px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* 특징 카드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            {
              emoji: '🎯',
              title: '난이도 자동 조절',
              desc: '맞히면 더 어려운 문제, 틀리면 더 쉬운 문제로 이동해 정확한 레벨을 찾아요',
            },
            {
              emoji: '📊',
              title: '영역별 실력 분석',
              desc: '초급·중급·고급 영역을 분석해 나에게 맞는 에이몬을 추천해드려요',
            },
            {
              emoji: '⏭️',
              title: '언제든 건너뛰기 가능',
              desc: '모르는 문제는 스킵해도 돼요. 결과에 반영되지만 불이익은 없어요',
            },
          ].map((f) => (
            <div key={f.title} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '7px 14px', background: '#F9F8FE', borderRadius: '14px',
            }}>
              <span style={{ fontSize: '17px', flexShrink: 0 }}>{f.emoji}</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#26215C', marginBottom: '1px' }}>{f.title}</div>
                <div style={{ fontSize: '9px', color: '#9B96D0', lineHeight: 1.4, wordBreak: 'keep-all' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 레벨 범위 바 */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#26215C', marginBottom: '4px' }}>테스트 레벨 범위</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '16px' }}>🐣</div>
              <div style={{ fontSize: '9px', color: '#9B96D0', marginTop: '2px' }}>입문</div>
            </div>
            <div style={{
              flex: 2, height: '3px',
              background: 'linear-gradient(90deg,#C4BFEE,#7F77DD,#534AB7)',
              borderRadius: '99px', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: '9px', height: '9px', borderRadius: '50%',
                background: '#7F77DD', border: '2px solid white',
                boxShadow: '0 0 6px rgba(127,119,221,.5)',
              }} />
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '16px' }}>🌳</div>
              <div style={{ fontSize: '9px', color: '#9B96D0', marginTop: '2px' }}>고급</div>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <button
          id="btn-level-test-start"
          onClick={onStart}
          style={{
            width: '100%', padding: '11px',
            background: '#7F77DD', color: 'white',
            border: '1px solid rgba(255,255,255,0.22)', borderRadius: '14px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 10px 22px rgba(83,74,183,.18), 0 0 0 1px rgba(127,119,221,.08)',
          }}
        >
          🎯 테스트 시작하기
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px',
              background: 'transparent', color: '#9B96D0',
              border: '1.5px solid #E5E2F8', borderRadius: '14px',
              fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            닫기
          </button>
        )}
      </div>
    </div>
  )
}
