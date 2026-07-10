'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { HONORS as FALLBACK } from '@/data/honors';
import type { Honor } from '@/data/honors';
import HonorMedal from '@/components/illust/HonorMedal';

export default function Page() {
  const [honors, setHonors] = useState<Honor[]>(FALLBACK);

  useEffect(() => {
    fetch('/api/honors').then(r => r.ok ? r.json() : null).then(d => { if (Array.isArray(d) && d.length) setHonors(d); }).catch(() => {});
  }, []);

  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">HONORS · 集体荣誉</span>
        <span className="sec-cn">荣 耀 墙</span>
      </div>
      <div className="sec-note">每一次共同的高光都值得被记住</div>

      <div className="honors-list">
        {honors.map((honor, idx) => (
          <div key={honor.id} className="honors-item">
            <div className="honors-item-medal">
              <HonorMedal />
              <div className="honors-item-seq">#{idx + 1}</div>
            </div>
            <div className="honors-item-body">
              <div className="honors-item-eyebrow">
                {honor.date} · {honor.awardedBy} 颁发
              </div>
              <h3 className="honors-item-title">{honor.title}</h3>
              <div className="honors-item-sub">{honor.subtitle}</div>
              <p className="honors-item-desc">{honor.description}</p>
              <div className="honors-item-meta">
                <span>编号 {honor.serial}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {honors.length <= 1 && (
        <div className="honors-empty">
          更多荣誉正在路上 · 我们一起加油
        </div>
      )}
      <Footer />
    </>
  );
}
