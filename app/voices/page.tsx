import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';

export default function Page() {
  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">VOICES · 小小旁白</span>
        <span className="sec-cn">童 言 无 忌</span>
      </div>
      <div className="sec-note">孩子们的奇思与天真话语</div>
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-soft)', letterSpacing: 2 }}>
        这一页正在书写中 · 敬请期待
      </div>
      <Footer />
    </>
  );
}
