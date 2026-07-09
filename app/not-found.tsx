import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found-code">404</div>
      <h1 className="not-found-title">这一页还没有写上去</h1>
      <p className="not-found-desc">
        也许下课铃响了，也许这页纸被风吹走了。
        <br />
        不如回到教室看看？
      </p>
      <Link href="/" className="not-found-link">← 回到首页</Link>
    </div>
  );
}
