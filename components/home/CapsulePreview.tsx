'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00').getTime();
  return Math.max(0, Math.ceil((target - Date.now()) / (24 * 3600 * 1000)));
}

export default function CapsulePreview() {
  const [count, setCount] = useState(0);
  const [openDate, setOpenDate] = useState('2032-06-30');
  const [title, setTitle] = useState('写给 2032 年毕业的我');
  const [intro, setIntro] = useState('每个小朋友都写下一封信，装进这枚时光胶囊。它会一直沉睡，直到 2032 年夏天毕业那天，才被一封封开启。');

  useEffect(() => {
    fetch('/api/capsule').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d) { setCount(d.count || 0); setOpenDate(d.openDate || '2032-06-30'); if (d.title) setTitle(d.title); if (d.intro) setIntro(d.intro); }
    });
  }, []);

  const days = daysUntil(openDate);

  return (
    <div className="capsule">
      <div className="capsule-stars">
        {[...Array(14)].map((_, i) => (
          <span key={i} style={{
            top: `${(i * 41) % 100}%`, left: `${(i * 59) % 100}%`,
            width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`,
            animationDelay: `${(i % 5) * 0.4}s`,
          }} />
        ))}
      </div>
      <div className="capsule-eyebrow">— 尘封中 · 距开启还有 {days.toLocaleString()} 天 —</div>
      <h3 className="capsule-title">{title}</h3>
      <p className="capsule-desc">{intro}</p>
      <div className="capsule-lock">
        <div className="capsule-lock-icon">🔒</div>
        <div className="capsule-lock-txt">
          <strong>已封存 {count} 封信</strong>
          <span>信件内容加密保存，开启日期前任何人都看不到</span>
        </div>
        <Link href="/capsule" className="capsule-cta">＋ 写一封信</Link>
      </div>
      <div className="capsule-count">开启日 · {openDate.replace(/-/g, '.')}</div>
    </div>
  );
}
