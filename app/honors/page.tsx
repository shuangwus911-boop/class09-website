import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';

export default function Page() {
  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">HONORS · 集体荣誉</span>
        <span className="sec-cn">荣 耀 墙</span>
      </div>
      <div className="sec-note">每一次共同的高光都值得被记住</div>
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--ink-soft)', letterSpacing: 2 }}>
        这一页正在书写中 · 敬请期待
      </div>
      <Footer />
    </>
  );
}
