import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';

export default function Page() {
  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">TIMELINE · 六年历程</span>
        <span className="sec-cn">时 光 轴</span>
      </div>
      <div className="sec-note">从一年级到毕业，每一步都是故事</div>
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-soft)', letterSpacing: 2 }}>
        这一页正在书写中 · 敬请期待
      </div>
      <Footer />
    </>
  );
}
