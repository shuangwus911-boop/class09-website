import Link from 'next/link';
import { SITE } from '@/data/site';

export default function Nav() {
  return (
    <div className="nav">
      <Link href="/" className="brand">
        <div className="brand-mark">{SITE.classCode}</div>
        <div>
          <div className="brand-jp">{SITE.brandJp}</div>
          <div className="brand-cn">{SITE.brandCn}</div>
        </div>
      </Link>
      <nav className="nav-links">
        <Link href="/">首页</Link>
        <Link href="/album">时光相册</Link>
        <Link href="/honors">荣耀墙</Link>
        <Link href="/voices">童言无忌</Link>
        <Link href="/timeline">时光轴</Link>
      </nav>
    </div>
  );
}
