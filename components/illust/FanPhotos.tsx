// 扇形展开时展示的照片占位插画（每个 slug 五张）
type Props = { slug: string; idx: number };

export default function FanPhoto({ slug, idx }: Props) {
  const key = `${slug}-${idx}`;
  // 简化处理：不同 slug 用不同色调，五张按 idx 变体
  const palettes: Record<string, string[]> = {
    'first-day': ['#f0d8a8', '#d8e0b8', '#f4e8c8', '#e8d8b8', '#f0dcc8'],
    'mid-autumn': ['#3d3a5c', '#e8b558', '#f0dcc8', '#5f7048', '#b84a3e'],
    'autumn-outing': ['#f0e2b8', '#a8d97a', '#e8d0a8', '#c4d4b8', '#f4e8c8'],
    'new-year': ['#b8d1d9', '#f0dcc8', '#faf4e4', '#d98b3c', '#5f7048'],
    'spring-outing': ['#c8e0d8', '#a8d97a', '#f0dcc8', '#e8f0d8', '#f4b8c8'],
    'childrens-day': ['#b84a3e', '#f4e8c8', '#c8e0d8', '#f0dcc8', '#faf4e4'],
  };
  const bg = (palettes[slug] ?? ['#ebe0c6'])[idx % 5] ?? '#ebe0c6';

  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill={bg} />
      {/* 简易场景元素做区分 */}
      {idx === 0 && (
        <g>
          <rect x="15" y="30" width="70" height="55" fill="rgba(255,255,255,0.4)" stroke="#3d2f21" strokeWidth="0.8" />
        </g>
      )}
      {idx === 1 && <circle cx="50" cy="45" r="18" fill="rgba(255,255,255,0.6)" stroke="#3d2f21" strokeWidth="0.8" />}
      {idx === 2 && (
        <g stroke="#3d2f21" strokeWidth="0.8" fill="none">
          <path d="M20,60 Q50,30 80,60" />
        </g>
      )}
      {idx === 3 && (
        <g>
          <line x1="50" y1="90" x2="50" y2="40" stroke="#5a3f28" strokeWidth="3" />
          <circle cx="50" cy="30" r="15" fill="rgba(232,181,88,0.8)" stroke="#3d2f21" />
        </g>
      )}
      {idx === 4 && (
        <g transform="translate(50,55)">
          <circle cx="-10" cy="-8" r="7" fill="#f4d8b8" stroke="#3d2f21" strokeWidth="0.6" />
          <circle cx="10" cy="-8" r="7" fill="#f4d8b8" stroke="#3d2f21" strokeWidth="0.6" />
        </g>
      )}
    </svg>
  );
}
