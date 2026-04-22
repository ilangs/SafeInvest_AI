export default function TutorCharacter({ size = 60, mood = 'neutral', showBubble = true }) {
  const mouthPath =
    mood === 'happy'
      ? 'M 18 30 Q 25 36 32 30'
      : mood === 'thinking'
      ? 'M 20 31 Q 25 29 30 31'
      : 'M 19 31 Q 25 34 31 31'

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 50 60"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="세이프 캐릭터"
      >
        {/* 몸통 (정장) */}
        <rect x="12" y="42" width="26" height="16" rx="4" fill="#1e3a5f" />
        <rect x="22" y="42" width="6" height="16" fill="#2563eb" />
        {/* 넥타이 */}
        <polygon points="25,43 23,49 25,52 27,49" fill="#ef4444" />
        {/* 얼굴 */}
        <circle cx="25" cy="26" r="16" fill="#fde68a" />
        {/* 안경 프레임 */}
        <rect x="12" y="22" width="10" height="7" rx="3" fill="none" stroke="#1e3a5f" strokeWidth="1.5" />
        <rect x="28" y="22" width="10" height="7" rx="3" fill="none" stroke="#1e3a5f" strokeWidth="1.5" />
        <line x1="22" y1="25" x2="28" y2="25" stroke="#1e3a5f" strokeWidth="1.5" />
        <line x1="11" y1="25" x2="12" y2="25" stroke="#1e3a5f" strokeWidth="1.5" />
        <line x1="38" y1="25" x2="39" y2="25" stroke="#1e3a5f" strokeWidth="1.5" />
        {/* 눈 */}
        <circle cx="17" cy="26" r="2" fill="#1e3a5f" />
        <circle cx="33" cy="26" r="2" fill="#1e3a5f" />
        {/* 입 */}
        <path d={mouthPath} stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* 머리카락 */}
        <path d="M 10 22 Q 12 10 25 10 Q 38 10 40 22 Q 35 16 25 17 Q 15 16 10 22 Z" fill="#1e3a5f" />
      </svg>

      {showBubble && (
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '10px 14px',
          fontSize: '13px',
          color: '#94a3b8',
          maxWidth: '220px',
          lineHeight: '1.5',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: '-8px', top: '16px',
            width: 0, height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderRight: '8px solid #334155',
          }} />
          안녕하세요! 저는 <strong style={{ color: '#22c55e' }}>세이프</strong>입니다.<br />
          함께 건전한 투자를 배워봐요.
        </div>
      )}
    </div>
  )
}
