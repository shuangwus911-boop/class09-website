'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { MOMENTS as FALLBACK } from '@/data/moments';
import type { Moment } from '@/data/moments';
import MomentCover from '@/components/illust/MomentCovers';

export default function Page() {
  const [moments, setMoments] = useState<Moment[]>(FALLBACK);

  useEffect(() => {
    fetch('/api/moments').then(r => r.ok ? r.json() : null).then(d => { if (d) setMoments(d); });
  }, []);

  // Group moments by semester
  const semesters = moments.reduce<Record<string, Moment[]>>((acc, m) => {
    if (!acc[m.semester]) acc[m.semester] = [];
    acc[m.semester].push(m);
    return acc;
  }, {});

  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">ALBUM · 全部时刻</span>
        <span className="sec-cn">时 光 相 册</span>
      </div>
      <div className="sec-note">按学期归档所有关键时刻 · 点击卡片查看详情</div>

      {Object.entries(semesters).map(([semester, items]) => (
        <div key={semester} className="album-semester">
          <div className="album-semester-label">{semester}</div>
          <div className="album-grid">
            {items.map((m) => (
              <div key={m.slug} className="album-card">
                <div className="album-card-cover">
                  <MomentCover slug={m.cover} />
                  <div className="moment-count">共 · {m.count} 张</div>
                </div>
                <div className="album-card-body">
                  <div className="album-card-title">{m.title}</div>
                  <div className="album-card-date">{m.date}</div>
                  {m.quote && (
                    <div className="album-card-quote">
                      「{m.quote.text.slice(0, 20)}…」
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="album-footer-note">
        更多照片正在归档中 · 如需投稿请联系班级管理员
      </div>
      <Footer />
    </>
  );
}
