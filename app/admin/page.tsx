'use client';

import { useState, useEffect } from 'react';

const API_BASE = '/api';

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

function MomentEditor({ token }: { token: string }) {
  const [moments, setMoments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/moments`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMoments(d); });
  }, [token]);

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

  return (
    <div className="admin-section">
      <h3>时光相册管理</h3>
      <p className="admin-hint">编辑关键时刻数据 · 保存后需重新构建网站生效</p>
      <textarea
        value={JSON.stringify(moments, null, 2)}
        onChange={e => { try { setMoments(JSON.parse(e.target.value)); } catch {} }}
        rows={20}
      />
      <div className="admin-actions">
        <button onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        {msg && <span className="admin-msg">{msg}</span>}
      </div>
    </div>
  );
}

function HonorEditor({ token }: { token: string }) {
  const [honors, setHonors] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/honors`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setHonors(d); });
  }, [token]);

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

  return (
    <div className="admin-section">
      <h3>荣耀墙管理</h3>
      <textarea
        value={JSON.stringify(honors, null, 2)}
        onChange={e => { try { setHonors(JSON.parse(e.target.value)); } catch {} }}
        rows={15}
      />
      <div className="admin-actions">
        <button onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        {msg && <span className="admin-msg">{msg}</span>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<'moments' | 'honors'>('moments');

  useEffect(() => {
    const stored = localStorage.getItem('cms_token');
    if (stored) setToken(stored);
  }, []);

  if (!token) return (
    <>
      <div className="admin-wrap">
        <AdminLogin onLogin={setToken} />
      </div>
    </>
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
      </div>
      {tab === 'moments' && <MomentEditor token={token} />}
      {tab === 'honors' && <HonorEditor token={token} />}
    </div>
  );
}
