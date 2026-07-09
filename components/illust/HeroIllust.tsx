// 首页 Hero 场景插画：秋日校园（山、云、校舍、银杏树、草地）
export default function HeroIllust() {
  return (
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e6d4a8" />
          <stop offset="100%" stopColor="#f0e2b8" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#skyG)" />
      <circle cx="320" cy="70" r="30" fill="#e8b558" opacity="0.7" />
      <path
        d="M0,170 L60,130 L110,150 L160,120 L220,145 L280,115 L340,140 L400,125 L400,200 L0,200 Z"
        fill="#b8a68a"
        opacity="0.6"
      />
      <path
        d="M0,180 L50,155 L100,170 L170,145 L240,168 L310,150 L400,165 L400,200 L0,200 Z"
        fill="#a89a7c"
        opacity="0.7"
      />
      <ellipse cx="80" cy="55" rx="28" ry="8" fill="#faf4e4" opacity="0.85" />
      <ellipse cx="200" cy="40" rx="24" ry="7" fill="#faf4e4" opacity="0.8" />
      <rect x="120" y="140" width="130" height="60" fill="#e8d0a8" stroke="#3d2f21" strokeWidth="1" />
      <polygon points="115,140 185,110 255,140" fill="#b84a3e" stroke="#3d2f21" strokeWidth="1" />
      <rect x="135" y="155" width="14" height="18" fill="#a89a7c" />
      <rect x="160" y="155" width="14" height="18" fill="#a89a7c" />
      <rect x="185" y="155" width="14" height="18" fill="#a89a7c" />
      <rect x="210" y="155" width="14" height="18" fill="#a89a7c" />
      <rect x="176" y="178" width="18" height="22" fill="#8a4a3a" />
      <rect x="0" y="200" width="400" height="100" fill="#8a9968" />
      <line x1="55" y1="205" x2="55" y2="180" stroke="#5a3f28" strokeWidth="2" />
      <circle cx="55" cy="170" r="18" fill="#e8b558" opacity="0.85" stroke="#3d2f21" strokeWidth="0.8" />
      <line x1="350" y1="215" x2="350" y2="185" stroke="#5a3f28" strokeWidth="2" />
      <circle cx="350" cy="175" r="20" fill="#c8975a" opacity="0.85" stroke="#3d2f21" strokeWidth="0.8" />
    </svg>
  );
}
