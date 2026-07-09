import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { MOMENTS } from '@/data/moments';

import MomentCover from '@/components/illust/MomentCovers';

export default function Page() {
  // Group moments by semester
  const semesters = MOMENTS.reduce<Record<string, typeof MOMENTS>>((acc, m) => {
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

      {Object.entries(semesters).map(([semester, moments]) => (
        <div key={semester} className="album-semester">
          <div className="album-semester-label">{semester}</div>
          <div className="album-grid">
            {moments.map((m) => (
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
