// 荣誉徽章：红丝带 + 中心五角星 + CLASS 09 刻字
export default function HonorMedal() {
  return (
    <svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="medalG" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#f4d878" />
          <stop offset="60%" stopColor="#e8b558" />
          <stop offset="100%" stopColor="#c8975a" />
        </radialGradient>
      </defs>
      <path d="M70,20 L110,20 L120,90 L90,110 L60,90 Z" fill="#b84a3e" stroke="#3d2f21" strokeWidth="1.5" />
      <path d="M70,20 L90,10 L110,20 L100,60 L90,55 L80,60 Z" fill="#d95a4e" stroke="#3d2f21" strokeWidth="1" />
      <circle cx="90" cy="115" r="52" fill="url(#medalG)" stroke="#3d2f21" strokeWidth="2" />
      <circle cx="90" cy="115" r="46" fill="none" stroke="#3d2f21" strokeWidth="0.8" opacity="0.5" />
      <path
        d="M90,88 L96,106 L115,106 L100,117 L106,135 L90,124 L74,135 L80,117 L65,106 L84,106 Z"
        fill="#faf4e4"
        stroke="#3d2f21"
        strokeWidth="1"
      />
      <text x="90" y="152" textAnchor="middle" fontSize="9" fill="#3d2f21" letterSpacing="2" fontFamily="serif">
        CLASS 09
      </text>
      <g stroke="#e8b558" strokeWidth="1" opacity="0.5">
        <line x1="90" y1="55" x2="90" y2="45" />
        <line x1="140" y1="115" x2="150" y2="115" />
        <line x1="90" y1="175" x2="90" y2="185" />
        <line x1="40" y1="115" x2="30" y2="115" />
      </g>
    </svg>
  );
}
