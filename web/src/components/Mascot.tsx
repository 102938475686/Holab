import { useId } from 'react'

// HoLab 마스코트 "올랍이": 머리 위 작은 저울(법)을 달고 있는 보라색 둥근 도우미.
// 깜빡이고 둥실 떠 있으며, 말할 때(talking) 입이 움직여요. (움직임 줄이기 설정이면 멈춤)
export default function Mascot({ size = 96, talking = false, className = '' }: { size?: number; talking?: boolean; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '') // 화면에 여러 개일 때 그라데이션 id가 겹치지 않게
  return (
    <svg viewBox="0 0 120 132" width={size} height={(size * 132) / 120} role="img" aria-label="HoLab 마스코트 올랍이" className={className}>
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9f7aea" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
        <radialGradient id={`f${id}`} cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ede7ff" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="124" rx="30" ry="5" fill="#2e1065" opacity="0.14" />
      <g className="mascot-bob">
        {/* 머리 위 저울 안테나 */}
        <g className="mascot-antenna" style={{ transformOrigin: '60px 30px' }}>
          <line x1="60" y1="31" x2="60" y2="11" stroke="#5b21b6" strokeWidth="3" strokeLinecap="round" />
          <line x1="45" y1="14" x2="75" y2="14" stroke="#5b21b6" strokeWidth="3" strokeLinecap="round" />
          <path d="M45 14 L38 26 Q45 30 52 26 Z" fill="#fbbf24" />
          <path d="M75 14 L68 26 Q75 30 82 26 Z" fill="#fbbf24" />
          <circle cx="60" cy="9" r="4.5" fill="#fbbf24" />
        </g>
        {/* 몸 */}
        <rect x="14" y="30" width="92" height="84" rx="36" fill={`url(#b${id})`} />
        <circle cx="13" cy="84" r="8" fill="#7c3aed" />
        <circle cx="107" cy="84" r="8" fill="#7c3aed" />
        {/* 얼굴 */}
        <rect x="24" y="42" width="72" height="56" rx="27" fill={`url(#f${id})`} />
        <g className="mascot-eyes">
          <ellipse cx="46" cy="66" rx="6.5" ry="8.5" fill="#2e1065" />
          <ellipse cx="74" cy="66" rx="6.5" ry="8.5" fill="#2e1065" />
          <circle cx="48.5" cy="62.5" r="2.4" fill="#fff" />
          <circle cx="76.5" cy="62.5" r="2.4" fill="#fff" />
        </g>
        <circle cx="35" cy="79" r="5.5" fill="#f9a8d4" opacity="0.65" />
        <circle cx="85" cy="79" r="5.5" fill="#f9a8d4" opacity="0.65" />
        {talking
          ? <ellipse className="mascot-mouth" cx="60" cy="83" rx="6.5" ry="5" fill="#be185d" />
          : <path d="M51 80 Q60 90 69 80" stroke="#2e1065" strokeWidth="3.2" fill="none" strokeLinecap="round" />}
      </g>
    </svg>
  )
}
