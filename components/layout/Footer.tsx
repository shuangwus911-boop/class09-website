import Link from 'next/link';
import { SITE } from '@/data/site';

export default function Footer() {
  return (
    <div className="foot">
      <div>
        © {SITE.className} · {SITE.span} · 由老师与家长共同书写
      </div>
      <Link href="/admin/" className="foot-admin">管理</Link>
      <div className="foot-seal">{SITE.seal}</div>
    </div>
  );
}
