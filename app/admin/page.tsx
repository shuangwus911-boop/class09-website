'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

type Moment = {
  slug: string;
  title: string;
  date: string;
  semester: string;
  count: number;
  badgeColor?: string;
  cover: string;
  photos: { id: string; caption: string; src?: string }[];
  quote?: { text: string; who: string; date: string };
  status?: 'draft' | 'published';
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
  status?: 'draft' | 'published';
};

type LogEntry = { ts: number; action: string; email: string; detail: string };

// --- Auth-aware fetch wrapper ---
function useAuthFetch(token: string, onExpired: () => void) {
  return useCallback(async (url: string, opts?: RequestInit) => {
    const headers: any = { ...(opts?.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      if (data.error === '登录已过期') {
        alert('登录已过期，请重新登录');
        onExpired();
      }
      throw new Error(data.error || '未登录');
    }
    return res;
  }, [token, onExpired]);
}

// --- Login + Register ---
function AdminLogin({ onLogin }: { onLogin: (token: string, role: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
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
      localStorage.setItem('cms_role', data.role || 'admin');
      onLogin(data.token, data.role || 'admin');
    } catch {
      setError('网络错误');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem('cms_token', data.token);
      localStorage.setItem('cms_role', data.role || 'editor');
      onLogin(data.token, data.role || 'editor');
    } catch {
      setError('网络错误');
    }
  };

  return (
    <div className="admin-login">
      <h2>班级网站管理后台</h2>
      {mode === 'login' ? (
        <>
          <p>请使用管理员账号登录</p>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} required />
            {error && <div className="admin-error">{error}</div>}
            <button type="submit">登 录</button>
          </form>
          <p style={{ marginTop: 20, fontSize: 12, color: 'var(--ink-soft)' }}>
            收到邀请码？<button onClick={() => { setMode('register'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--warm-red)', cursor: 'pointer', fontSize: 12, letterSpacing: 1 }}>注册新账号</button>
          </p>
        </>
      ) : (
        <>
          <p>使用站长提供的邀请码注册</p>
          <form onSubmit={handleRegister}>
            <input placeholder="邀请码（6位）" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} maxLength={6} required style={{ textAlign: 'center', letterSpacing: 4, fontFamily: 'monospace' }} />
            <input type="email" placeholder="你的邮箱" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="设置密码" value={password} onChange={e => setPassword(e.target.value)} required />
            {error && <div className="admin-error">{error}</div>}
            <button type="submit">注 册</button>
          </form>
          <p style={{ marginTop: 20, fontSize: 12, color: 'var(--ink-soft)' }}>
            已有账号？<button onClick={() => { setMode('login'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--warm-red)', cursor: 'pointer', fontSize: 12, letterSpacing: 1 }}>返回登录</button>
          </p>
        </>
      )}
    </div>
  );
}

// --- Moment Card with status ---
function MomentCard({ moment, onChange, onRemove, role, onPublish, onUnpublish }: {
  moment: Moment;
  onChange: (m: Moment) => void;
  onRemove: () => void;
  role: string;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const update = (field: string, value: any) => onChange({ ...moment, [field]: value });
  const updateQuote = (field: string, value: string) => {
    const q = moment.quote || { text: '', who: '', date: '' };
    onChange({ ...moment, quote: { ...q, [field]: value } });
  };
  const isDraft = moment.status === 'draft';

  return (
    <div className="admin-card" style={isDraft ? { borderLeft: '3px solid var(--warm-orange)' } : {}}>
      <div className="admin-card-header">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="admin-card-badge" style={{ background: `var(--badge-${moment.badgeColor || 'red'})` }}>{moment.semester || '未设置学期'}</span>
          {isDraft && <span style={{ fontSize: 10, color: 'var(--warm-orange)', letterSpacing: 1 }}>草稿</span>}
          {!isDraft && <span style={{ fontSize: 10, color: 'var(--sage-deep)', letterSpacing: 1 }}>已发布</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {role === 'admin' && isDraft && <button className="admin-btn-icon" onClick={onPublish} title="发布" style={{ color: 'var(--sage-deep)', borderColor: 'var(--sage-deep)' }}>✓</button>}
          {role === 'admin' && !isDraft && <button className="admin-btn-icon" onClick={onUnpublish} title="下架" style={{ color: 'var(--warm-orange)', borderColor: 'var(--warm-orange)' }}>↓</button>}
          <button className="admin-btn-icon" onClick={onRemove} title="删除此条">×</button>
        </div>
      </div>
      <div className="admin-card-grid">
        <label><span>标题</span><input value={moment.title} onChange={e => update('title', e.target.value)} placeholder="开学第一天" /></label>
        <label><span>日期</span><input value={moment.date} onChange={e => update('date', e.target.value)} placeholder="2025.09.01" /></label>
        <label><span>学期</span><input value={moment.semester} onChange={e => update('semester', e.target.value)} placeholder="2025 秋 · 一上" /></label>
        <label><span>照片数</span><input type="number" value={moment.count} onChange={e => update('count', parseInt(e.target.value) || 0)} /></label>
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

// --- Moment Editor ---
function MomentEditor({ token, role, authFetch }: { token: string; role: string; authFetch: any }) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/moments?all=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMoments(d); });
  }, [token]);

  const save = async () => {
    setSaving(true);
    try {
      await authFetch(`${API_BASE}/moments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moments),
      });
      setMsg('已保存');
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
    setTimeout(() => setMsg(''), 2000);
  };

  const add = () => {
    const d = new Date();
    setMoments([...moments, {
      slug: `moment-${Date.now()}`, title: '', date: `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`,
      semester: '', count: 0, badgeColor: 'red', cover: '', photos: [], status: 'draft',
    }]);
  };

  const publish = async (slug: string) => {
    try {
      await authFetch(`${API_BASE}/moments/${slug}/publish`, { method: 'PUT' });
      setMoments(moments.map(m => m.slug === slug ? { ...m, status: 'published' } : m));
    } catch {}
  };

  const unpublish = async (slug: string) => {
    try {
      await authFetch(`${API_BASE}/moments/${slug}/unpublish`, { method: 'PUT' });
      setMoments(moments.map(m => m.slug === slug ? { ...m, status: 'draft' } : m));
    } catch {}
  };

  const drafts = moments.filter(m => m.status === 'draft');
  const published = moments.filter(m => m.status !== 'draft');

  return (
    <div className="admin-section">
      <div className="admin-section-top">
        <h3>时光相册 <span className="admin-count">{moments.length}</span>{drafts.length > 0 && <span style={{ marginLeft: 8, color: 'var(--warm-orange)', fontSize: 11 }}>({drafts.length}篇待审)</span>}</h3>
        <button className="admin-btn-add" onClick={add}>+ 添加时刻</button>
      </div>
      {drafts.length > 0 && <p className="admin-hint">橙色边框 = 草稿，需站长发布后前台才可见</p>}
      <div className="admin-card-list">
        {moments.map((m, i) => (
          <MomentCard key={m.slug} moment={m} role={role}
            onChange={upd => { const n = [...moments]; n[i] = upd; setMoments(n); }}
            onRemove={() => { if (confirm('删除「' + (m.title || '未命名') + '」？')) setMoments(moments.filter((_, j) => j !== i)); }}
            onPublish={() => publish(m.slug)}
            onUnpublish={() => unpublish(m.slug)}
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

// --- Honor Editor ---
function HonorEditor({ token, authFetch }: { token: string; authFetch: any }) {
  const [honors, setHonors] = useState<Honor[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/honors?all=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setHonors(d); });
  }, [token]);

  const save = async () => {
    setSaving(true);
    try {
      await authFetch(`${API_BASE}/honors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(honors),
      });
      setMsg('已保存');
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
    setTimeout(() => setMsg(''), 2000);
  };

  const add = () => {
    setHonors([...honors, { id: `h-${Date.now()}`, title: '', subtitle: '', date: '', awardedBy: '', serial: '', description: '', featured: false, status: 'draft' }]);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top">
        <h3>荣耀墙 <span className="admin-count">{honors.length}</span></h3>
        <button className="admin-btn-add" onClick={add}>+ 添加荣誉</button>
      </div>
      <div className="admin-card-list">
        {honors.map((h, i) => (
          <div key={h.id} className="admin-card">
            <div className="admin-card-header">
              <span className="admin-card-badge" style={{ background: 'var(--badge-blue)' }}>{h.date || '未设置日期'}</span>
              <button className="admin-btn-icon" onClick={() => { if (confirm('删除「' + (h.title || '未命名') + '」？')) setHonors(honors.filter((_, j) => j !== i)); }} title="删除此条">×</button>
            </div>
            <div className="admin-card-grid">
              <label><span>荣誉名称</span><input value={h.title} onChange={e => { const n = [...honors]; n[i] = { ...h, title: e.target.value }; setHonors(n); }} /></label>
              <label><span>副标题</span><input value={h.subtitle} onChange={e => { const n = [...honors]; n[i] = { ...h, subtitle: e.target.value }; setHonors(n); }} /></label>
              <label><span>日期</span><input value={h.date} onChange={e => { const n = [...honors]; n[i] = { ...h, date: e.target.value }; setHonors(n); }} /></label>
              <label><span>颁发单位</span><input value={h.awardedBy} onChange={e => { const n = [...honors]; n[i] = { ...h, awardedBy: e.target.value }; setHonors(n); }} /></label>
              <label><span>编号</span><input value={h.serial} onChange={e => { const n = [...honors]; n[i] = { ...h, serial: e.target.value }; setHonors(n); }} /></label>
              <label className="admin-full"><span>描述</span><textarea value={h.description} onChange={e => { const n = [...honors]; n[i] = { ...h, description: e.target.value }; setHonors(n); }} rows={3} /></label>
              <label className="admin-check"><input type="checkbox" checked={h.featured || false} onChange={e => { const n = [...honors]; n[i] = { ...h, featured: e.target.checked }; setHonors(n); }} /><span>首页展示</span></label>
            </div>
          </div>
        ))}
        {honors.length === 0 && <p className="admin-empty">暂无数据</p>}
      </div>
      <div className="admin-actions">
        <button className="admin-btn-save" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存所有更改'}</button>
        {msg && <span className="admin-msg">{msg}</span>}
      </div>
    </div>
  );
}

// --- Image Manager (shows existing + upload + delete for admin) ---
function ImageManager({ token, role, authFetch }: { token: string; role: string; authFetch: any }) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/moments?all=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMoments(d); });
  }, [token]);

  const selectedMoment = moments.find(m => m.slug === selectedSlug);
  const existingPhotos = selectedMoment?.photos || [];

  const uploadFiles = async (files: FileList | File[]) => {
    if (!selectedSlug) { setError('请先选择归属时刻'); return; }
    setError('');
    setUploading(true);
    const newPhotos: { id: string; caption: string; src: string }[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() || 'jpg';
      const key = `${selectedSlug}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', key);

      try {
        const res = await authFetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.ok) {
          newPhotos.push({ id: key.split('/').pop()?.replace(/\.\w+$/, '') || `p-${Date.now()}`, caption: file.name.replace(/\.\w+$/, ''), src: data.url });
        } else {
          setError(data.error || '上传失败');
        }
      } catch (e: any) {
        if (e.message !== '登录已过期') setError('网络错误');
      }
    }

    if (newPhotos.length > 0) {
      const updated = moments.map(m => {
        if (m.slug !== selectedSlug) return m;
        return { ...m, photos: [...m.photos, ...newPhotos], count: m.count + newPhotos.length };
      });
      setMoments(updated);
      await authFetch(`${API_BASE}/moments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
    }
    setUploading(false);
  };

  const deletePhoto = async (photo: any, idx: number) => {
    if (!confirm(`删除图片「${photo.caption || photo.id}」？此操作不可恢复`)) return;
    // Delete from R2 if it has src path
    if (photo.src) {
      const key = photo.src.replace('/images/', '');
      try { await authFetch(`${API_BASE}/images/${key}`, { method: 'DELETE' }); } catch {}
    }
    // Remove from moment data
    const updated = moments.map(m => {
      if (m.slug !== selectedSlug) return m;
      const photos = m.photos.filter((_, i) => i !== idx);
      return { ...m, photos, count: photos.length };
    });
    setMoments(updated);
    await authFetch(`${API_BASE}/moments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top"><h3>图片管理</h3></div>
      <div className="admin-card-grid" style={{ marginBottom: 16 }}>
        <label><span>归属时刻</span>
          <select value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}>
            <option value="">-- 选择时刻 --</option>
            {moments.map(m => <option key={m.slug} value={m.slug}>{m.title || m.slug} ({m.photos?.length || 0}张)</option>)}
          </select>
        </label>
      </div>

      {/* Existing photos */}
      {selectedSlug && existingPhotos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', letterSpacing: 1, marginBottom: 8 }}>已有 {existingPhotos.length} 张照片</p>
          <div className="admin-upload-grid">
            {existingPhotos.map((p, i) => (
              <div key={i} className="admin-upload-thumb" style={{ position: 'relative' }}>
                {p.src ? <img src={p.src} alt={p.caption} /> : <div style={{ width: '100%', height: '100%', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{p.caption || p.id}</div>}
                {role === 'admin' && (
                  <button onClick={() => deletePhoto(p, i)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, background: 'var(--warm-red)', color: '#fff', border: 'none', borderRadius: '50%', fontSize: 11, cursor: 'pointer', lineHeight: '16px' }}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedSlug && existingPhotos.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>该时刻暂无照片</p>
      )}

      {/* Upload zone */}
      <div
        className={`admin-upload-zone${dragOver ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <p>{uploading ? '上传中...' : '拖拽图片到这里，或点击选择文件'}</p>
        <small>支持 jpg / png / webp / gif · 单张最大 10MB</small>
        <input id="file-input" type="file" accept="image/*" multiple onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
      </div>
      {error && <div className="admin-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

// --- Log Viewer (admin only) ---
function LogViewer({ token, authFetch }: { token: string; authFetch: any }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`${API_BASE}/logs`)
      .then((r: Response) => r.json())
      .then((d: any) => { if (Array.isArray(d)) setLogs(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch]);

  const actionLabel: Record<string, string> = {
    login: '登录', upload: '上传图片', delete_image: '删除图片',
    update_moments: '更新相册', update_honors: '更新荣耀',
    update_quotes: '更新童言', publish_moment: '发布时刻',
    unpublish_moment: '下架时刻', create_invite: '生成邀请码',
    revoke_invite: '撤销邀请码', register: '注册',
    update_teacher: '更新寄语', update_music: '更新背景音乐',
    update_capsule_meta: '更新胶囊封面', seal_letter: '密封一封信',
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top"><h3>操作日志</h3></div>
      {loading && <p className="admin-empty">加载中...</p>}
      {!loading && logs.length === 0 && <p className="admin-empty">暂无日志</p>}
      {!loading && logs.length > 0 && (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(61,47,33,0.15)', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', letterSpacing: 1 }}>时间</th>
              <th style={{ padding: '6px 8px', letterSpacing: 1 }}>操作</th>
              <th style={{ padding: '6px 8px', letterSpacing: 1 }}>操作人</th>
              <th style={{ padding: '6px 8px', letterSpacing: 1 }}>详情</th>
            </tr></thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(61,47,33,0.08)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{new Date(log.ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: '6px 8px' }}>{actionLabel[log.action] || log.action}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{log.email.split('@')[0]}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--ink-soft)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Invite Manager (admin only) ---
function InviteManager({ authFetch }: { authFetch: any }) {
  const [role, setRole] = useState('editor');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvites = async () => {
    try {
      const res = await authFetch(`${API_BASE}/invites`);
      const data = await res.json();
      if (Array.isArray(data)) setInvites(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadInvites(); }, [authFetch]);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      const res = await authFetch(`${API_BASE}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, note }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`邀请码：${data.code}（角色：${data.role}，7天有效）`);
        setNote('');
        loadInvites();
      } else setMsg(data.error);
    } catch (e: any) { setMsg(e.message); }
  };

  const revoke = async (code: string) => {
    if (!confirm(`撤销邀请码 ${code}？`)) return;
    try {
      await authFetch(`${API_BASE}/invite/${code}`, { method: 'DELETE' });
      setInvites(invites.filter(i => i.code !== code));
    } catch {}
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top"><h3>邀请码管理</h3></div>
      <p className="admin-hint">生成邀请码发给老师或家长，他们凭码在登录页自助注册。每个邀请码只能用一次，7天后过期。</p>
      <form onSubmit={generate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: 1 }}>角色</span>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: '7px 10px', border: '1px solid rgba(61,47,33,0.2)', background: 'var(--cream)', fontSize: 13, fontFamily: 'inherit' }}>
            <option value="editor">编辑 (可上传内容)</option>
            <option value="admin">站长 (可审核发布)</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-soft)', letterSpacing: 1 }}>备注（选填）</span>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="如：张老师" style={{ padding: '7px 10px', border: '1px solid rgba(61,47,33,0.2)', background: 'var(--cream)', fontSize: 13, fontFamily: 'inherit' }} />
        </label>
        <button type="submit" className="admin-btn-add" style={{ height: 34 }}>生成邀请码</button>
      </form>
      {msg && <p style={{ fontSize: 13, color: 'var(--warm-red)', letterSpacing: 1, marginBottom: 12, fontFamily: 'monospace', background: 'rgba(184,74,62,0.06)', padding: '8px 12px', border: '1px dashed var(--warm-red)' }}>{msg}</p>}

      {/* Active invites */}
      {!loading && invites.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', letterSpacing: 1, marginBottom: 8 }}>待使用的邀请码：</p>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(61,47,33,0.15)', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>邀请码</th>
              <th style={{ padding: '6px 8px' }}>角色</th>
              <th style={{ padding: '6px 8px' }}>备注</th>
              <th style={{ padding: '6px 8px' }}>生成时间</th>
              <th style={{ padding: '6px 8px' }}></th>
            </tr></thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.code} style={{ borderBottom: '1px solid rgba(61,47,33,0.08)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', letterSpacing: 2 }}>{inv.code}</td>
                  <td style={{ padding: '6px 8px' }}>{inv.role === 'admin' ? '站长' : '编辑'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{inv.note || '-'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{new Date(inv.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: '6px 8px' }}><button onClick={() => revoke(inv.code)} style={{ background: 'none', border: 'none', color: 'var(--warm-red)', cursor: 'pointer', fontSize: 11 }}>撤销</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && invites.length === 0 && <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>暂无待使用的邀请码</p>}
    </div>
  );
}

// --- Teacher Letter Editor ---
type TeacherLetter = {
  id: string; year: number; yearLabel: string; title: string; text: string;
  teacher: string; role: string; date: string; featured?: boolean; status?: 'draft' | 'published';
};

function TeacherEditor({ token, role, authFetch }: { token: string; role: string; authFetch: any }) {
  const [letters, setLetters] = useState<TeacherLetter[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/teacher?all=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setLetters(d); });
  }, [token]);

  const save = async () => {
    setSaving(true);
    try {
      await authFetch(`${API_BASE}/teacher`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(letters),
      });
      setMsg('已保存');
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
    setTimeout(() => setMsg(''), 2000);
  };

  const add = () => {
    const y = new Date().getFullYear();
    setLetters([...letters, {
      id: `letter-${Date.now()}`, year: y, yearLabel: `${y} 学年`, title: '', text: '',
      teacher: '', role: '班主任', date: `${y}.09.01`, featured: false, status: 'draft',
    }]);
  };

  const upd = (i: number, field: string, value: any) => {
    const n = [...letters];
    if (field === 'featured' && value) {
      n.forEach((l, j) => { l.featured = j === i; });
    } else {
      (n[i] as any)[field] = value;
    }
    setLetters(n);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top">
        <h3>班主任寄语 <span className="admin-count">{letters.length}</span></h3>
        <button className="admin-btn-add" onClick={add}>+ 添加一封寄语</button>
      </div>
      <p className="admin-hint">每个学年一封，班主任写给孩子们的话。勾选「首页展示」的那封会出现在首页预览。</p>
      <div className="admin-card-list">
        {letters.map((l, i) => {
          const isDraft = l.status === 'draft';
          return (
            <div key={l.id} className="admin-card" style={isDraft ? { borderLeft: '3px solid var(--warm-orange)' } : {}}>
              <div className="admin-card-header">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="admin-card-badge" style={{ background: 'var(--badge-green)' }}>{l.yearLabel || '未设置学年'}</span>
                  {isDraft && <span style={{ fontSize: 10, color: 'var(--warm-orange)', letterSpacing: 1 }}>草稿</span>}
                  {!isDraft && <span style={{ fontSize: 10, color: 'var(--sage-deep)', letterSpacing: 1 }}>已发布</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {role === 'admin' && <button className="admin-btn-icon" onClick={() => upd(i, 'status', isDraft ? 'published' : 'draft')} title={isDraft ? '发布' : '下架'} style={{ color: isDraft ? 'var(--sage-deep)' : 'var(--warm-orange)', borderColor: isDraft ? 'var(--sage-deep)' : 'var(--warm-orange)' }}>{isDraft ? '✓' : '↓'}</button>}
                  <button className="admin-btn-icon" onClick={() => { if (confirm('删除这封寄语？')) setLetters(letters.filter((_, j) => j !== i)); }} title="删除此条">×</button>
                </div>
              </div>
              <div className="admin-card-grid">
                <label><span>学年</span><input type="number" value={l.year} onChange={e => upd(i, 'year', parseInt(e.target.value) || l.year)} /></label>
                <label><span>学年标签</span><input value={l.yearLabel} onChange={e => upd(i, 'yearLabel', e.target.value)} placeholder="2025 学年 · 一年级" /></label>
                <label><span>标题</span><input value={l.title} onChange={e => upd(i, 'title', e.target.value)} placeholder="致我亲爱的孩子们" /></label>
                <label><span>老师姓名</span><input value={l.teacher} onChange={e => upd(i, 'teacher', e.target.value)} placeholder="王老师" /></label>
                <label><span>身份</span><input value={l.role} onChange={e => upd(i, 'role', e.target.value)} placeholder="班主任" /></label>
                <label><span>日期</span><input value={l.date} onChange={e => upd(i, 'date', e.target.value)} placeholder="2025.09.01" /></label>
                <label className="admin-full"><span>正文</span><textarea value={l.text} onChange={e => upd(i, 'text', e.target.value)} rows={6} placeholder="亲爱的孩子们……" /></label>
                <label className="admin-check"><input type="checkbox" checked={l.featured || false} onChange={e => upd(i, 'featured', e.target.checked)} /><span>首页展示</span></label>
              </div>
            </div>
          );
        })}
        {letters.length === 0 && <p className="admin-empty">暂无寄语，点击上方按钮添加第一封</p>}
      </div>
      <div className="admin-actions">
        <button className="admin-btn-save" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存所有更改'}</button>
        {msg && <span className="admin-msg">{msg}</span>}
      </div>
    </div>
  );
}

// --- Music Manager (background music / 班级之声) ---
function MusicManager({ authFetch }: { authFetch: any }) {
  const [cfg, setCfg] = useState<{ src: string; title: string; subtitle: string; enabled: boolean }>({ src: '', title: '童话梦想家', subtitle: '班级之声', enabled: true });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/music`).then(r => r.json()).then(d => { if (d && d.src) setCfg({ src: d.src, title: d.title || '童话梦想家', subtitle: d.subtitle || '班级之声', enabled: d.enabled !== false }); }).catch(() => {});
  }, []);

  const uploadAudio = async (file: File) => {
    setError(''); setUploading(true);
    const ext = file.name.split('.').pop() || 'mp3';
    const key = `music/${Date.now()}.${ext}`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', key);
    try {
      const res = await authFetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) { setCfg(c => ({ ...c, src: data.url })); setMsg('音频已上传，记得点保存'); setTimeout(() => setMsg(''), 3000); }
      else setError(data.error || '上传失败');
    } catch (e: any) { if (e.message !== '登录已过期') setError('网络错误'); }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await authFetch(`${API_BASE}/music`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      setMsg('已保存');
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top"><h3>班级之声 · 背景音乐</h3></div>
      <p className="admin-hint">上传一首歌（如《童话梦想家》），访客打开网站后会自动轻声播放；受浏览器限制，可能需要访客点一下页面才会出声。右下角有一个可暂停的唱片按钮。</p>

      <div
        className="admin-upload-zone"
        onClick={() => document.getElementById('music-input')?.click()}
        style={{ marginBottom: 16 }}
      >
        <p>{uploading ? '上传中...' : (cfg.src ? '已有音频 · 点击可替换' : '点击选择音频文件')}</p>
        <small>支持 mp3 / m4a / ogg / wav · 最大 20MB</small>
        <input id="music-input" type="file" accept="audio/*" onChange={e => { if (e.target.files?.[0]) uploadAudio(e.target.files[0]); e.target.value = ''; }} style={{ display: 'none' }} />
      </div>

      {cfg.src && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', letterSpacing: 1, marginBottom: 6 }}>试听：</p>
          <audio controls src={cfg.src} style={{ width: '100%' }} />
        </div>
      )}

      <div className="admin-card-grid">
        <label><span>歌曲名</span><input value={cfg.title} onChange={e => setCfg({ ...cfg, title: e.target.value })} placeholder="童话梦想家" /></label>
        <label><span>副标题</span><input value={cfg.subtitle} onChange={e => setCfg({ ...cfg, subtitle: e.target.value })} placeholder="班级之声" /></label>
        <label className="admin-check"><input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} /><span>启用背景音乐</span></label>
      </div>
      {error && <div className="admin-error" style={{ marginTop: 8 }}>{error}</div>}
      <div className="admin-actions">
        <button className="admin-btn-save" onClick={save} disabled={saving || !cfg.src}>{saving ? '保存中...' : '保存背景音乐设置'}</button>
        {msg && <span className="admin-msg">{msg}</span>}
      </div>
    </div>
  );
}

// --- Capsule Settings (time capsule封面/开启日期，信件内容永久密封不可读) ---
function CapsuleSettings({ authFetch }: { authFetch: any }) {
  const [meta, setMeta] = useState<{ title: string; intro: string; openDate: string }>({ title: '写给 2032 年毕业的我', intro: '每个小朋友都写下一封信，装进这枚时光胶囊。它会一直沉睡，直到 2032 年夏天毕业那天，才被一封封开启。', openDate: '2032-06-30' });
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/capsule`).then(r => r.json()).then(d => {
      if (d) { setCount(d.count || 0); setMeta({ title: d.title || meta.title, intro: d.intro || meta.intro, openDate: d.openDate || meta.openDate }); }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await authFetch(`${API_BASE}/capsule_meta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      });
      setMsg('已保存');
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="admin-section">
      <div className="admin-section-top"><h3>时光胶囊 <span className="admin-count">{count} 封信</span></h3></div>
      <p className="admin-hint">🔒 所有信件都被完全密封，任何人（包括站长）都无法读取内容，只有到 {meta.openDate} 开启日之后才能一封封打开。这里只能设置封面文字和开启日期。</p>
      <div className="admin-card-grid">
        <label><span>开启日期</span><input type="date" value={meta.openDate} onChange={e => setMeta({ ...meta, openDate: e.target.value })} /></label>
        <label className="admin-full"><span>标题</span><input value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} placeholder="写给 2032 年毕业的我" /></label>
        <label className="admin-full"><span>引言</span><textarea value={meta.intro} onChange={e => setMeta({ ...meta, intro: e.target.value })} rows={4} /></label>
      </div>
      <div className="admin-actions">
        <button className="admin-btn-save" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存封面设置'}</button>
        {msg && <span className="admin-msg">{msg}</span>}
      </div>
    </div>
  );
}

// --- Main Page ---
export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string>('admin');
  const [tab, setTab] = useState<'moments' | 'honors' | 'teacher' | 'capsule' | 'music' | 'images' | 'logs' | 'accounts'>('moments');

  const logout = useCallback(() => {
    localStorage.removeItem('cms_token');
    localStorage.removeItem('cms_role');
    setToken(null);
  }, []);

  const authFetch = useAuthFetch(token || '', logout);

  useEffect(() => {
    const stored = localStorage.getItem('cms_token');
    const storedRole = localStorage.getItem('cms_role') || 'admin';
    if (stored) { setToken(stored); setRole(storedRole); }
  }, []);

  if (!token) return (
    <div className="admin-wrap">
      <AdminLogin onLogin={(t, r) => { setToken(t); setRole(r); }} />
    </div>
  );

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <h2>09班 · 内容管理 <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 400, marginLeft: 8 }}>{role === 'admin' ? '站长' : '编辑'}</span></h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/" style={{ fontSize: 12, letterSpacing: 1, color: 'var(--ink-soft)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--warm-red)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-soft)')}>← 返回首页</a>
          <button onClick={logout}>退出</button>
        </div>
      </div>
      <div className="admin-tabs">
        <button className={tab === 'moments' ? 'active' : ''} onClick={() => setTab('moments')}>时光相册</button>
        <button className={tab === 'honors' ? 'active' : ''} onClick={() => setTab('honors')}>荣耀墙</button>
        <button className={tab === 'teacher' ? 'active' : ''} onClick={() => setTab('teacher')}>班主任寄语</button>
        <button className={tab === 'capsule' ? 'active' : ''} onClick={() => setTab('capsule')}>时光胶囊</button>
        <button className={tab === 'music' ? 'active' : ''} onClick={() => setTab('music')}>班级之声</button>
        <button className={tab === 'images' ? 'active' : ''} onClick={() => setTab('images')}>图片管理</button>
        {role === 'admin' && <button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>操作日志</button>}
        {role === 'admin' && <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>邀请码</button>}
      </div>
      {tab === 'moments' && <MomentEditor token={token} role={role} authFetch={authFetch} />}
      {tab === 'honors' && <HonorEditor token={token} authFetch={authFetch} />}
      {tab === 'teacher' && <TeacherEditor token={token} role={role} authFetch={authFetch} />}
      {tab === 'capsule' && <CapsuleSettings authFetch={authFetch} />}
      {tab === 'music' && <MusicManager authFetch={authFetch} />}
      {tab === 'images' && <ImageManager token={token} role={role} authFetch={authFetch} />}
      {tab === 'logs' && role === 'admin' && <LogViewer token={token} authFetch={authFetch} />}
      {tab === 'accounts' && role === 'admin' && <InviteManager authFetch={authFetch} />}
    </div>
  );
}
