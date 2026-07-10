'use client';

import { useEffect, useRef, useState } from 'react';

type MusicConfig = {
  src: string;
  title: string;
  subtitle?: string;
  enabled?: boolean;
};

const STORAGE_KEY = 'class09_music_playing';

export default function ClassMusic() {
  const [cfg, setCfg] = useState<MusicConfig | null>(null);
  const [playing, setPlaying] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('class09_music_hidden') !== '1';
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('/api/music')
      .then(r => (r.ok ? r.json() : null))
      .then((d: MusicConfig | null) => {
        if (d && d.src && d.enabled !== false) setCfg(d);
      })
      .catch(() => {});
  }, []);

  // Restore playback on page load
  useEffect(() => {
    if (!cfg || !audioRef.current) return;
    const el = audioRef.current;
    el.volume = 0.4;

    const wasPlaying = sessionStorage.getItem(STORAGE_KEY) === '1';
    const savedTime = sessionStorage.getItem('class09_music_time');

    if (wasPlaying && savedTime) {
      el.currentTime = parseFloat(savedTime);
    }

    // Try to play (will fail without user gesture on fresh load)
    el.play().then(() => {
      setPlaying(true);
      setNeedTap(false);
    }).catch(() => {
      setNeedTap(wasPlaying); // show ♪ if was playing before
    });
  }, [cfg]);

  // Save play state on change
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, playing ? '1' : '0');
  }, [playing]);

  // Save currentTime while playing
  useEffect(() => {
    if (!playing || !audioRef.current) return;
    const iv = setInterval(() => {
      if (audioRef.current) {
        sessionStorage.setItem('class09_music_time', String(audioRef.current.currentTime));
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [playing]);

  // Wait for first user interaction to auto-play
  useEffect(() => {
    const kick = async () => {
      if (!audioRef.current || !visible) return;
      if (audioRef.current.paused) {
        try {
          await audioRef.current.play();
          setPlaying(true);
          setNeedTap(false);
        } catch {}
      }
    };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, [visible]);

  const src = cfg?.src || '/bgm.m4a';

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
    sessionStorage.setItem('class09_music_hidden', '1');
  };

  const reopen = () => {
    setVisible(true);
    sessionStorage.setItem('class09_music_hidden', '0');
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setPlaying(true);
        setNeedTap(false);
      }).catch(() => setNeedTap(true));
    }
  };

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="auto" />
      {visible && (
        <button
          className={`class-music-disc${playing ? ' spinning' : ''}`}
          onClick={toggle}
          onContextMenu={(e) => { e.preventDefault(); stop(); }}
          aria-label={playing ? '暂停音乐' : '播放音乐'}
          title={playing ? '暂停音乐（右键关闭）' : '播放音乐（右键关闭）'}
        >
          <span className="class-music-disc-center" />
          {(!playing || needTap) && <span className="class-music-play-badge">{needTap ? '♪' : '▶'}</span>}
        </button>
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
