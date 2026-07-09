// 每个"时刻"的封面场景插画。用 slug 分发。

type Props = { slug: string };

export default function MomentCover({ slug }: Props) {
  switch (slug) {
    case 'first-day':
      return (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <rect width="200" height="150" fill="#e8d0a8" />
          <polygon points="10,90 100,50 190,90 190,150 10,150" fill="#b84a3e" opacity="0.85" />
          <rect x="30" y="90" width="140" height="60" fill="#e8d0a8" stroke="#3d2f21" />
          <rect x="45" y="100" width="16" height="20" fill="#a89a7c" />
          <rect x="75" y="100" width="16" height="20" fill="#a89a7c" />
          <rect x="110" y="100" width="16" height="20" fill="#a89a7c" />
          <rect x="140" y="100" width="16" height="20" fill="#a89a7c" />
          <rect x="93" y="125" width="16" height="25" fill="#5a3f28" />
          <circle cx="150" cy="40" r="14" fill="#e8b558" />
        </svg>
      );
    case 'mid-autumn':
      return (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <rect width="200" height="150" fill="#3d3a5c" />
          <circle cx="150" cy="45" r="22" fill="#f4e8c8" />
          <rect x="0" y="90" width="200" height="60" fill="#5f7048" />
          <g fill="#e8b558" stroke="#3d2f21" strokeWidth="0.6">
            <circle cx="40" cy="110" r="6" />
            <circle cx="80" cy="115" r="6" />
            <circle cx="130" cy="110" r="6" />
            <circle cx="170" cy="115" r="6" />
          </g>
        </svg>
      );
    case 'autumn-outing':
      return (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <rect width="200" height="150" fill="#f0e2b8" />
          <path d="M0,110 L40,80 L80,100 L120,70 L160,95 L200,80 L200,150 L0,150 Z" fill="#a89a7c" />
          <line x1="120" y1="120" x2="120" y2="82" stroke="#5a3f28" strokeWidth="2" />
          <circle cx="120" cy="72" r="16" fill="#e8b558" stroke="#3d2f21" />
          <line x1="40" y1="115" x2="40" y2="80" stroke="#5a3f28" strokeWidth="2" />
          <circle cx="40" cy="72" r="14" fill="#d98b3c" stroke="#3d2f21" />
        </svg>
      );
    case 'new-year':
      return (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <rect width="200" height="150" fill="#b8d1d9" />
          <rect x="0" y="100" width="200" height="50" fill="#faf4e4" />
          <g fill="#faf4e4" opacity="0.9">
            <circle cx="30" cy="30" r="2" />
            <circle cx="80" cy="20" r="2" />
            <circle cx="130" cy="35" r="2" />
          </g>
          <rect x="60" y="60" width="80" height="40" fill="#b84a3e" stroke="#3d2f21" />
          <text x="100" y="87" textAnchor="middle" fontSize="18" fill="#faf4e4" fontFamily="serif">
            2026
          </text>
        </svg>
      );
    case 'spring-outing':
      return (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <rect width="200" height="150" fill="#c8e0d8" />
          <ellipse cx="70" cy="55" rx="26" ry="8" fill="#faf4e4" />
          <rect x="0" y="100" width="200" height="50" fill="#a8d97a" />
          <line x1="30" y1="110" x2="30" y2="80" stroke="#5a3f28" strokeWidth="2" />
          <circle cx="30" cy="72" r="14" fill="#f4b8c8" stroke="#3d2f21" />
          <line x1="170" y1="115" x2="170" y2="85" stroke="#5a3f28" strokeWidth="2" />
          <circle cx="170" cy="78" r="15" fill="#f4b8c8" stroke="#3d2f21" />
        </svg>
      );
    case 'childrens-day':
      return (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <rect width="200" height="150" fill="#f4e8c8" />
          <g stroke="#3d2f21" strokeWidth="1" fill="#b84a3e"><circle cx="50" cy="50" r="20" /></g>
          <g stroke="#3d2f21" strokeWidth="1" fill="#e8b558"><circle cx="100" cy="40" r="18" /></g>
          <g stroke="#3d2f21" strokeWidth="1" fill="#5f7048"><circle cx="150" cy="55" r="20" /></g>
          <rect x="0" y="95" width="200" height="55" fill="#faf4e4" />
          <text x="100" y="130" textAnchor="middle" fontSize="20" fill="#b84a3e" fontFamily="serif">
            61
          </text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
          <rect width="200" height="150" fill="#ebe0c6" />
          <text x="100" y="80" textAnchor="middle" fontSize="14" fill="#6b5942" fontFamily="serif">
            照 片
          </text>
        </svg>
      );
  }
}
