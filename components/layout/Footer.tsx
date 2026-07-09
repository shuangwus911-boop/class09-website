import { SITE } from '@/data/site';

export default function Footer() {
  return (
    <div className="foot">
      <div>
        © {SITE.className} · {SITE.span} · 由老师与家长共同书写
      </div>
      <div className="foot-seal">{SITE.seal}</div>
    </div>
  );
}
