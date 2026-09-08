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

type LookupResult = {
  child: string;
  count: number;
  letters: { sealedAt: number; chars: number; author: string }[];
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
  const [child, setChild] = useState('');
  const [birthday, setBirthday] = useState('');
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ child: string; mine: number } | null>(null);
  const [error, setError] = useState('');

  const [mode, setMode] = useState<'write' | 'lookup'>('write');
  const [lookupChild, setLookupChild] = useState('');
  const [lookupBirthday, setLookupBirthday] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  useEffect(() => {
    fetch('/api/capsule').then(r => (r.ok ? r.json() : null)).then(d => { if (d) setMeta(d); }).catch(() => {});
  }, []);

  const seal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!child.trim()) { setError('请填写孩子姓名'); return; }
    if (!/^\d{8}$/.test(birthday.trim())) { setError('生日请填 8 位数字，如 20180315'); return; }
    if (!text.trim()) { setError('信的内容不能为空'); return; }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/capsule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child: child.trim(),
          birthday: birthday.trim(),
          author: author.trim() || '匿名',
          text,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '封存失败'); setSending(false); return; }
      setMeta(m => ({ ...m, count: data.count ?? m.count + 1 }));
      setDone({ child: data.child || child.trim(), mine: data.mine || 1 });
    } catch {
      setError('网络错误，请稍后再试');
    }
    setSending(false);
  };

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupChild.trim()) { setLookupError('请填写孩子姓名'); return; }
    if (!/^\d{8}$/.test(lookupBirthday.trim())) { setLookupError('生日请填 8 位数字，如 20180315'); return; }
    setLooking(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const qs = new URLSearchParams({ child: lookupChild.trim(), birthday: lookupBirthday.trim() });
      const res = await fetch(`/api/capsule/lookup?${qs}`);
      const data = await res.json();
      if (!res.ok) { setLookupError(data.error || '查询失败'); setLooking(false); return; }
      setLookupResult(data);
    } catch {
      setLookupError('网络错误，请稍后再试');
    }
    setLooking(false);
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

        <div className="capsule-switch">
          <button type="button" className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>写 一 封 信</button>
          <button type="button" className={mode === 'lookup' ? 'active' : ''} onClick={() => setMode('lookup')}>查查我交过没有</button>
        </div>

        {mode === 'lookup' ? (
          <form className="capsule-form" onSubmit={lookup}>
            <div className="capsule-form-lock">🔎 凭孩子姓名 + 生日可以查到交了几封、什么时候交的，但正文要等到 {meta.openDate.replace(/-/g, '.')} 才会显示。刚封存的信可能要一分钟后才出现在这里。</div>
            <label className="capsule-field">
              <span>孩子姓名</span>
              <input value={lookupChild} onChange={e => setLookupChild(e.target.value)} placeholder="如：王嘉嘉" maxLength={20} />
            </label>
            <label className="capsule-field">
              <span>孩子生日（8 位数字）</span>
              <input value={lookupBirthday} onChange={e => setLookupBirthday(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="如：20180315" inputMode="numeric" />
            </label>
            {lookupError && <div className="admin-error">{lookupError}</div>}
            <button className="capsule-seal-btn" type="submit" disabled={looking}>{looking ? '查询中…' : '查 询'}</button>
            {lookupResult && (
              <div className="capsule-lookup-result">
                {lookupResult.count === 0 ? (
                  <p>没有查到 <strong>{lookupResult.child}</strong> 名下的信。如果是刚刚才封存的，请等一分钟再查；也可能是姓名或生日跟当时填的不一致。</p>
                ) : (
                  <>
                    <p><strong>{lookupResult.child}</strong> 名下已封存 <strong>{lookupResult.count}</strong> 封信：</p>
                    <ul>
                      {lookupResult.letters.map((l, i) => (
                        <li key={i}>
                          第 {i + 1} 封 · {new Date(l.sealedAt).toLocaleDateString('zh-CN')} 封存 · {l.chars} 字 · 署名「{l.author}」
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </form>
        ) : done ? (
          <div className="capsule-done">
            <div className="capsule-done-icon">🔒</div>
            <h3>{done.child} 的第 {done.mine} 封信已封存</h3>
            <p>它会安静地睡在时光胶囊里，直到 {meta.openDate.replace(/-/g, '.')} 才被开启。<br/>在那之前，任何人都看不到它的内容——包括你自己。</p>
            <p className="capsule-done-tip">以后想确认交没交，用同样的<strong>孩子姓名 + 生日</strong>回到这个页面点「查查我交过没有」就行。</p>
            <button className="capsule-again" onClick={() => { setDone(null); setText(''); setAuthor(''); }}>再写一封</button>
          </div>
        ) : (
          <form className="capsule-form" onSubmit={seal}>
            <div className="capsule-form-lock">🔒 写下的内容会被立即封存加密，2031 年开启日前谁都无法查看</div>
            <label className="capsule-field">
              <span>孩子姓名（建议写真名，开启日才好对上人）</span>
              <input value={child} onChange={e => setChild(e.target.value)} placeholder="如：王嘉嘉" maxLength={20} />
            </label>
            <label className="capsule-field">
              <span>孩子生日（8 位数字，日后凭姓名 + 生日可查）</span>
              <input value={birthday} onChange={e => setBirthday(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="如：20180315" inputMode="numeric" />
            </label>
            <label className="capsule-field">
              <span>署名（选填，可匿名）</span>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="如：嘉嘉 / 嘉嘉妈妈 / 匿名" maxLength={40} />
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
