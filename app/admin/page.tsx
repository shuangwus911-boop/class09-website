'use client';

import { useState, useEffect } from 'react';

const API_BASE = '/api';

type Moment = {
  slug: string;
  title: string;
  date: string;
  semester: string;
  count: number;
  badgeColor?: string;
  cover: string;
  photos: { id: string; caption: string }[];
  quote?: { text: string; who: string; date: string };
};

type Honor = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  awardedBy: string;
  serial: string;
  description: string;
  featured?: boolean;
};

function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem('cms_token', data.token);
      onLogin(data.token);
    } catch {
      setError('网络错误');
    }
  };

  return (
    <div className="admin-login">
      <h2>班级网站管理后台</h2>
      <p>请使用管理员账号登录</p>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <div className="admin-error">{error}</div>}
        <button type="submit">登 录</button>
      </form>
    </div>
  );
}

function MomentCard({ moment, onChange, onRemove }: {
  moment: Moment;
  onChange: (m: Moment) => void;
  onRemove: () => void;
}) {
  const update = (field: string, value: any) => onChange({ ...moment, [field]: value });
  const updateQuote = (field: string, value: string) => {
    const q = moment.quote || { text: '', who: '', date: '' };
    onChange({ ...moment, quote: { ...q, [field]: value } });
  };

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <span className="admin-card-badge" style={{ background: `var(--badge-${moment.badgeColor || 'red'})` }}>{moment.semester || '未设置学期'}</span>
        <button className="admin-btn-icon" onClick={onRemove} title="删除此条">×</button>
      </div>
      <div className="admin-card-grid">
        <label><span>标题</span><input value={moment.title} onChange={e => update('title', e.target.value)} placeholder="开学第一天" /></label>
        <label><span>日期</span><input value={moment.date} onChange={e => update('date', e.target.value)} placeholder="2025.09.01" /></label>
        <label><span>学期</span><input value={moment.semester} onChange={e => update('semester', e.target.value)} placeholder="2025 秋 · 一上" /></label>
        <label><span>slug</span><input value={moment.slug} onChange={e => update('slug', e.target.value)} placeholder="first-day" /></label>
        <label><span>照片数</span><input type="number" value={moment.count} onChange={e => update('count', parseInt(e.target.value) || 0)} /></label>
        <label><span>封面key</span><input value={moment.cover} onChange={e => update('cover', e.target.value)} placeholder="firstDay" /></label>
        <label><span>色标</span>
          <select value={moment.badgeColor || 'red'} onChange={e => update('badgeColor', e.target.value)}>
            <option value="red">红</option><option value="green">绿</option><option value="orange">橙</option><option value="blue">蓝</option><option value="purple">紫</option>
          </select>
        </label>
      </div>
      <details className="admin-card-detail">
        <summary>童言 (选填)</summary>
        <div className="admin-card-grid">
          <label><span>内容</span><input value={moment.quote?.text || ''} onChange={e => updateQuote('text', e.target.value)} placeholder="童言内容…" /></label>
          <label><span>谁说的</span><input value={moment.quote?.who || ''} onChange={e => updateQuote('who', e.target.value)} placeholder="小名" /></label>
          <label><span>日期</span><input value={moment.quote?.date || ''} onChange={e => updateQuote('date', e.target.value)} placeholder="09.01" /></label>
        </div>
      </details>
    </div>
  );
}

function MomentEditor({ token }: { token: string }) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/moments`).then(r => r.json()).then(d => { if (Array.isArray(d)) setMoments(d); });
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch(`${API_BASE}/moments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(moments),
    });
    setSaving(false);
    setMsg('已保存');
    setTimeout(() => setMsg(''), 2000);
  };

  const add = () => {
    const d = new Date();
    setMoments([...moments, {
      slug: `moment-${Date.now()}`, title: '', date: `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`,
      semester: '', count: 0, badgeColor: 'red', cover: '', photos: [],
    }]);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top">
        <h3>时光相册 <span className="admin-count">{moments.length}</span></h3>
        <button className="admin-btn-add" onClick={add}>+ 添加时刻</button>
      </div>
      <div className="admin-card-list">
        {moments.map((m, i) => (
          <MomentCard key={m.slug} moment={m}
            onChange={upd => { const n = [...moments]; n[i] = upd; setMoments(n); }}
            onRemove={() => { if (confirm('删除「' + (m.title || '未命名') + '」？')) setMoments(moments.filter((_, j) => j !== i)); }}
          />
        ))}
        {moments.length === 0 && <p className="admin-empty">暂无数据，点击上方按钮添加第一个时刻</p>}
      </div>
      <div className="admin-actions">
        <button className="admin-btn-save" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存所有更改'}</button>
        {msg && <span className="admin-msg">{msg}</span>}
      </div>
    </div>
  );
}

function HonorCard({ honor, onChange, onRemove }: {
  honor: Honor;
  onChange: (h: Honor) => void;
  onRemove: () => void;
}) {
  const update = (field: string, value: any) => onChange({ ...honor, [field]: value });

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <span className="admin-card-badge" style={{ background: 'var(--badge-blue)' }}>{honor.date || '未设置日期'}</span>
        <button className="admin-btn-icon" onClick={onRemove} title="删除此条">×</button>
      </div>
      <div className="admin-card-grid">
        <label><span>荣誉名称</span><input value={honor.title} onChange={e => update('title', e.target.value)} placeholder="文明礼仪示范班" /></label>
        <label><span>副标题</span><input value={honor.subtitle} onChange={e => update('subtitle', e.target.value)} placeholder="学年学期" /></label>
        <label><span>日期</span><input value={honor.date} onChange={e => update('date', e.target.value)} placeholder="2026.06.28" /></label>
        <label><span>颁发单位</span><input value={honor.awardedBy} onChange={e => update('awardedBy', e.target.value)} placeholder="校德育处" /></label>
        <label><span>编号</span><input value={honor.serial} onChange={e => update('serial', e.target.value)} placeholder="WL-2026-春-09" /></label>
        <label className="admin-full"><span>描述</span><textarea value={honor.description} onChange={e => update('description', e.target.value)} rows={3} placeholder="荣誉描述…" /></label>
        <label className="admin-check"><input type="checkbox" checked={honor.featured || false} onChange={e => update('featured', e.target.checked)} /><span>首页展示</span></label>
      </div>
    </div>
  );
}

function HonorEditor({ token }: { token: string }) {
  const [honors, setHonors] = useState<Honor[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/honors`).then(r => r.json()).then(d => { if (Array.isArray(d)) setHonors(d); });
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch(`${API_BASE}/honors`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(honors),
    });
    setSaving(false);
    setMsg('已保存');
    setTimeout(() => setMsg(''), 2000);
  };

  const add = () => {
    setHonors([...honors, { id: `h-${Date.now()}`, title: '', subtitle: '', date: '', awardedBy: '', serial: '', description: '', featured: false }]);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top">
        <h3>荣耀墙 <span className="admin-count">{honors.length}</span></h3>
        <button className="admin-btn-add" onClick={add}>+ 添加荣誉</button>
      </div>
      <div className="admin-card-list">
        {honors.map((h, i) => (
          <HonorCard key={h.id} honor={h}
            onChange={upd => { const n = [...honors]; n[i] = upd; setHonors(n); }}
            onRemove={() => { if (confirm('删除「' + (h.title || '未命名') + '」？')) setHonors(honors.filter((_, j) => j !== i)); }}
          />
        ))}
        {honors.length === 0 && <p className="admin-empty">暂无数据，点击上方按钮添加第一条荣誉</p>}
      </div>
      <div className="admin-actions">
        <button className="admin-btn-save" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存所有更改'}</button>
        {msg && <span className="admin-msg">{msg}</span>}
      </div>
    </div>
  );
}

function ImageUploader({ token }: { token: string }) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ name: string; url: string }[]>([]);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/moments`).then(r => r.json()).then(d => { if (Array.isArray(d)) setMoments(d); });
  }, []);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!selectedSlug) { setError('请先选择归属时刻'); return; }
    setError('');
    setUploading(true);
    const newResults: { name: string; url: string }[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() || 'jpg';
      const key = `${selectedSlug}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', key);

      try {
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (data.ok) {
          newResults.push({ name: file.name, url: data.url });
        } else {
          setError(data.error || '上传失败');
        }
      } catch {
        setError('网络错误');
      }
    }

    setResults(prev => [...newResults, ...prev]);
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top">
        <h3>图片管理</h3>
      </div>
      <div className="admin-card-grid" style={{ marginBottom: 16 }}>
        <label><span>归属时刻</span>
          <select value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}>
            <option value="">-- 选择时刻 --</option>
            {moments.map(m => <option key={m.slug} value={m.slug}>{m.title || m.slug}</option>)}
          </select>
        </label>
      </div>
      <div
        className={`admin-upload-zone${dragOver ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <p>{uploading ? '上传中...' : '拖拽图片到这里，或点击选择文件'}</p>
        <p style={{ fontSize: 11, color: 'var(--ink-soft)' }}>支持 jpg / png / webp / gif · 单张最大 10MB</p>
        <input type="file" accept="image/*" multiple onChange={handleFileInput} style={{ marginTop: 8 }} />
      </div>
      {error && <div className="admin-error" style={{ marginTop: 8 }}>{error}</div>}
      {results.length > 0 && (
        <div className="admin-upload-results">
          <h4>已上传 ({results.length})</h4>
          <div className="admin-upload-grid">
            {results.map((r, i) => (
              <div key={i} className="admin-upload-thumb">
                <img src={r.url} alt={r.name} />
                <span>{r.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<'moments' | 'honors' | 'images'>('moments');

  useEffect(() => {
    const stored = localStorage.getItem('cms_token');
    if (stored) setToken(stored);
  }, []);

  if (!token) return (
    <div className="admin-wrap">
      <AdminLogin onLogin={setToken} />
    </div>
  );

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <h2>09班 · 内容管理</h2>
        <button onClick={() => { localStorage.removeItem('cms_token'); setToken(null); }}>退出</button>
      </div>
      <div className="admin-tabs">
        <button className={tab === 'moments' ? 'active' : ''} onClick={() => setTab('moments')}>时光相册</button>
        <button className={tab === 'honors' ? 'active' : ''} onClick={() => setTab('honors')}>荣耀墙</button>
        <button className={tab === 'images' ? 'active' : ''} onClick={() => setTab('images')}>图片管理</button>
      </div>
      {tab === 'moments' && <MomentEditor token={token} />}
      {tab === 'honors' && <HonorEditor token={token} />}
      {tab === 'images' && <ImageUploader token={token} />}
    </div>
  );
}
