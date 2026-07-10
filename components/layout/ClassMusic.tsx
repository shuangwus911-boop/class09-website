'use client';

import { useEffect, useRef, useState } from 'react';

type MusicConfig = {
  src: string;
  title: string;
  subtitle?: string;
  enabled?: boolean;
};

export default function ClassMusic() {
  const [cfg, setCfg] = useState<MusicConfig | null>(null);
  const [playing, setPlaying] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [visible, setVisible] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('/api/music')
      .then(r => (r.ok ? r.json() : null))
      .then((d: MusicConfig | null) => {
        if (d && d.src && d.enabled !== false) setCfg(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cfg || !audioRef.current) return;
    const el = audioRef.current;
    el.volume = 0.4;
    const tryPlay = async () => {
      try {
        await el.play();
        setPlaying(true);
      } catch {
        setNeedTap(true);
        const kick = async () => {
          try {
            await el.play();
            setPlaying(true);
            setNeedTap(false);
          } catch {}
          window.removeEventListener('pointerdown', kick);
          window.removeEventListener('keydown', kick);
        };
        window.addEventListener('pointerdown', kick, { once: true });
        window.addEventListener('keydown', kick, { once: true });
      }
    };
    tryPlay();
  }, [cfg]);

  // Determine actual src: KV > public fallback
  const src = cfg?.src || '/bgm.m4a';
  const title = cfg?.title || '童话梦想家';
  const subtitle = cfg?.subtitle || '圈圈宝贝';

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        await el.play();
        setPlaying(true);
        setNeedTap(false);
      } catch {}
    }
  };

  const stop = () => {
    const el = audioRef.current;
    if (el) { el.pause(); el.currentTime = 0; }
    setPlaying(false);
    setVisible(false);
  };

  const reopen = () => {
    setVisible(true);
    if (audioRef.current) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setNeedTap(true));
    }
  };

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="none" />
      {visible && (
        <div className="class-music">
          <button
            className={`class-music-disc${playing ? ' spinning' : ''}`}
            onClick={toggle}
            aria-label={playing ? '暂停' : '播放'}
            title={title}
          >
            <span className="class-music-disc-center" />
            {!playing && <span className="class-music-play-badge">{needTap ? '♪' : '▶'}</span>}
          </button>
          <div className="class-music-info" onClick={toggle}>
            <div className="class-music-title">{title}</div>
            <div className="class-music-sub">{subtitle}</div>
          </div>
          <button
            className="class-music-close"
            onClick={(e) => { e.stopPropagation(); stop(); }}
            aria-label="关闭音乐"
            title="关闭音乐"
          >×</button>
        </div>
      )}
      {!visible && (
        <button
          onClick={reopen}
          className="class-music-reopen"
          aria-label="打开音乐"
          title="打开音乐"
        >♪</button>
      )}
    </>
  );
}
