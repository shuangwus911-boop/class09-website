'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';

type CapsuleMeta = {
  count: number;
  openDate: string;   // YYYY-MM-DD
  title: string;
  intro: string;
};

const FALLBACK: CapsuleMeta = {
  count: 0,
  openDate: '2031-06-30',
  title: '写给 2031 年毕业的我',
  intro: '每个小朋友都写下一封信，装进这枚时光胶囊。它会一直沉睡，直到 2031 年夏天毕业那天，才被一封封开启，看看六年前那个刚上一年级的自己。',
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00').getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((target - now) / (24 * 3600 * 1000)));
}

export default function Page() {
  const [meta, setMeta] = useState<CapsuleMeta>(FALLBACK);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/capsule').then(r => (r.ok ? r.json() : null)).then(d => { if (d) setMeta(d); }).catch(() => {});
  }, []);

  const seal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { setError('信的内容不能为空'); return; }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/capsule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: author.trim() || '匿名', text }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '封存失败'); setSending(false); return; }
      setMeta(m => ({ ...m, count: data.count ?? m.count + 1 }));
      setDone(true);
    } catch {
      setError('网络错误，请稍后再试');
    }
    setSending(false);
  };

  const days = daysUntil(meta.openDate);

  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">TIME CAPSULE · 写给毕业的自己</span>
        <span className="sec-cn">时 光 胶 囊</span>
      </div>
      <div className="sec-note">此刻封存，六年后开启 · 一年级的你，想对毕业的你说什么？</div>

      <div className="capsule-page">
        <div className="capsule-hero">
          <div className="capsule-stars">
            {[...Array(18)].map((_, i) => (
              <span key={i} style={{
                top: `${(i * 37) % 100}%`, left: `${(i * 53) % 100}%`,
                width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`,
                animationDelay: `${(i % 5) * 0.4}s`,
              }} />
            ))}
          </div>
          <div className="capsule-hero-eyebrow">— 尘封中 · 距开启还有 {days.toLocaleString()} 天 —</div>
          <h2 className="capsule-hero-title">{meta.title}</h2>
          <p className="capsule-hero-desc">{meta.intro}</p>
          <div className="capsule-hero-stat">
            <div><strong>{meta.count}</strong><span>已封存的信</span></div>
            <div className="capsule-hero-divider" />
            <div><strong>{meta.openDate.replace(/-/g, '.')}</strong><span>开启日</span></div>
          </div>
        </div>

        {done ? (
          <div className="capsule-done">
            <div className="capsule-done-icon">🔒</div>
            <h3>你的信已封存</h3>
            <p>它会安静地睡在时光胶囊里，直到 {meta.openDate.replace(/-/g, '.')} 才被开启。<br/>在那之前，任何人都看不到它的内容——包括你自己。</p>
            <button className="capsule-again" onClick={() => { setDone(false); setText(''); setAuthor(''); }}>再写一封</button>
          </div>
        ) : (
          <form className="capsule-form" onSubmit={seal}>
            <div className="capsule-form-lock">🔒 写下的内容会被立即封存加密，2031 年开启日前谁都无法查看</div>
            <label className="capsule-field">
              <span>署名（选填，可匿名）</span>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="如：朵朵 / 朵朵妈妈 / 匿名" maxLength={40} />
            </label>
            <label className="capsule-field">
              <span>写给六年后的信</span>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={9} placeholder="亲爱的六年后的我……" maxLength={5000} />
            </label>
            {error && <div className="admin-error">{error}</div>}
            <button className="capsule-seal-btn" type="submit" disabled={sending}>{sending ? '封存中…' : '封 存 这 封 信'}</button>
          </form>
        )}
      </div>

      <Footer />
    </>
  );
}
