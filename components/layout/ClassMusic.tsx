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
  const [expanded, setExpanded] = useState(false);
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

  if (!cfg || !visible) return null;

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

  return (
    <>
      <audio ref={audioRef} src={cfg.src} loop preload="auto" />
      <div className={`class-music${expanded ? ' expanded' : ''}`}>
        <button
          className={`class-music-disc${playing ? ' spinning' : ''}`}
          onClick={toggle}
          aria-label={playing ? '暂停' : '播放'}
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          title={cfg.title}
        >
          <span className="class-music-disc-center" />
          {!playing && <span className="class-music-play-badge">{needTap ? '♪' : '▶'}</span>}
        </button>
        <div className="class-music-info" onClick={toggle}>
          <div className="class-music-title">{cfg.title}</div>
          {cfg.subtitle && <div className="class-music-sub">{cfg.subtitle}</div>}
        </div>
        <button
          className="class-music-close"
          onClick={(e) => { e.stopPropagation(); stop(); }}
          aria-label="关闭音乐"
          title="关闭音乐"
        >×</button>
      </div>
    </>
  );
}
