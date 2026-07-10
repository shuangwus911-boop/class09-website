'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { MOMENTS as FALLBACK } from '@/data/moments';
import type { Moment } from '@/data/moments';

export default function Page() {
  const [moments, setMoments] = useState<Moment[]>(FALLBACK);

  useEffect(() => {
    fetch('/api/moments').then(r => r.ok ? r.json() : null).then(d => { if (Array.isArray(d) && d.length) setMoments(d); }).catch(() => {});
  }, []);

  // Collect all quotes from moments
  const quotes = moments
    .filter((m) => m.quote)
    .map((m) => ({
      text: m.quote!.text,
      who: m.quote!.who,
      date: m.quote!.date,
      moment: m.title,
      slug: m.slug,
      badgeColor: m.badgeColor,
    }));

  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">VOICES · 小小旁白</span>
        <span className="sec-cn">童 言 无 忌</span>
      </div>
      <div className="sec-note">孩子们的奇思与天真话语 · 收集于每一个关键时刻</div>

      <div className="voices-grid">
        {quotes.map((q, idx) => (
          <div key={idx} className={`voice-card voice-card--${q.badgeColor || 'red'}`}>
            <div className="voice-card-mark">「</div>
            <p className="voice-card-text">{q.text}</p>
            <div className="voice-card-footer">
              <span className="voice-card-who">— {q.who}</span>
              <span className="voice-card-from">{q.moment} · {q.date}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="voices-note">
        童言由老师与家长在活动中记录 · 持续更新中
      </div>
      <Footer />
    </>
  );
}
