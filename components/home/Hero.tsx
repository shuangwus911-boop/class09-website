import { SITE } from '@/data/site';

export default function Hero() {
  return (
    <div className="hero">
      <div>
        <div className="hero-tag">A CLASS DIARY · {SITE.span}</div>
        <h1 className="hero-title">
          与四十六位小朋友，
          <br />
          共度<em>六个</em>春夏秋冬。
        </h1>
        <p className="hero-lead">
          课堂里、操场上、放学路上的微小闪光，
          <br />
          都被我们收进这本纸页中，一页一页地长大。
        </p>
        <a className="cta" href="/album/">
          走 进 教 室 ›
        </a>
      </div>
      <div className="hero-illust">
        <img src="/hero-class.png" alt="一（09）班全体小朋友" />
      </div>
    </div>
  );
}
