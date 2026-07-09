import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';

export default function Page() {
  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">ALBUM · 全部时刻</span>
        <span className="sec-cn">时 光 相 册</span>
      </div>
      <div className="sec-note">按学年归档所有关键时刻</div>
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-soft)', letterSpacing: 2 }}>
        这一页正在书写中 · 敬请期待
      </div>
      <Footer />
    </>
  );
}
