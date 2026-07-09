import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/home/Hero';
import MomentCarousel from '@/components/home/MomentCarousel';
import LatestHonor from '@/components/home/LatestHonor';
import Timeline from '@/components/home/Timeline';
import { MOMENTS } from '@/data/moments';
import { getLatestHonor } from '@/data/honors';
import { TIMELINE } from '@/data/timeline';

export default function HomePage() {
  return (
    <>
      <Nav />
      <Hero />

      <div className="sec-title" style={{ marginTop: 48 }}>
        <span className="sec-jp">MOMENTS · 关键时刻 &amp; 童言</span>
        <span className="sec-cn">时 光 相 册</span>
      </div>
      <div className="sec-note">
        每一个值得停留的时刻　·　点开卡片，照片折扇展开　·　卡片底部是那天的一句童言
      </div>
      <MomentCarousel moments={MOMENTS} />

      <div className="sec-title" style={{ marginTop: 56 }}>
        <span className="sec-jp">HONOR · 最新集体荣誉</span>
        <span className="sec-cn">最 近 的 一 束 光</span>
      </div>
      <div className="sec-note">刚刚发生的一次集体高光　·　查看更多请去 荣耀墙</div>
      <LatestHonor honor={getLatestHonor()} />

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
