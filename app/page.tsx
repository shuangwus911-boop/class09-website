'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/home/Hero';
import MomentCarousel from '@/components/home/MomentCarousel';
import LatestHonor from '@/components/home/LatestHonor';
import Timeline from '@/components/home/Timeline';
import CapsulePreview from '@/components/home/CapsulePreview';
import TeacherPreview from '@/components/home/TeacherPreview';
import { MOMENTS as FALLBACK_MOMENTS } from '@/data/moments';
import { HONORS as FALLBACK_HONORS, getLatestHonor } from '@/data/honors';
import { TIMELINE } from '@/data/timeline';
import type { Moment } from '@/data/moments';
import type { Honor } from '@/data/honors';

export default function HomePage() {
  const [moments, setMoments] = useState<Moment[]>(FALLBACK_MOMENTS);
  const [honors, setHonors] = useState<Honor[]>(FALLBACK_HONORS);

  useEffect(() => {
    fetch('/api/moments').then(r => r.ok ? r.json() : null).then(d => { if (d) setMoments(d); });
    fetch('/api/honors').then(r => r.ok ? r.json() : null).then(d => { if (d) setHonors(d); });
  }, []);

  const latestHonor = honors.find(h => h.featured) ?? honors[0];

  return (
    <>
      <Nav />
      <Hero />

      <div className="sec-title" style={{ marginTop: 48 }}>
        <span className="sec-jp">MOMENTS · 关键时刻 &amp; 童言</span>
        <span className="sec-cn">时 光 相 册</span>
      </div>
      <div className="sec-note">
        每一个值得停留的时刻，都是我们美好的回忆
      </div>
      <MomentCarousel moments={moments} />

      <div className="sec-title" style={{ marginTop: 56 }}>
        <span className="sec-jp">HONOR · 最新集体荣誉</span>
        <span className="sec-cn">最 近 的 一 束 光</span>
      </div>
      {latestHonor && <LatestHonor honor={latestHonor} />}

      <div className="sec-title" style={{ marginTop: 56 }}>
        <span className="sec-jp">FROM TEACHER</span>
        <span className="sec-cn">班 主 任 寄 语</span>
      </div>
      <div className="sec-note">何老师写给孩子们的一封信</div>
      <TeacherPreview />

      <div className="sec-title" style={{ marginTop: 56 }}>
        <span className="sec-jp">TIME CAPSULE · 写给毕业的自己</span>
        <span className="sec-cn">时 光 胶 囊</span>
      </div>
      <div className="sec-note">此刻封存，六年后开启　·　一年级的你，想对毕业的你说什么？</div>
      <CapsulePreview />

      <div className="sec-title" style={{ marginTop: 56 }}>
        <span className="sec-jp">TIMELINE · 六年时光</span>
        <span className="sec-cn">时 光 轴</span>
      </div>
      <div className="sec-note">2025 秋　→　2032 夏　·　我们要一起走的六个学年</div>
      <Timeline nodes={TIMELINE} />

      <Footer />
    </>
  );
}
