'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Moment } from '@/data/moments';
import MomentCover from '@/components/illust/MomentCovers';
import FanPhoto from '@/components/illust/FanPhotos';

type Props = { moments: Moment[] };

export default function MomentCarousel({ moments }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const closeAll = useCallback(() => setOpenId(null), []);

  const scrollBy = useCallback((dir: number) => {
    trackRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });
    setOpenId(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeAll]);

  return (
    <>
      <div className="carousel-wrap">
        <button className="arrow left" onClick={() => scrollBy(-1)} aria-label="上一组">
          ‹
        </button>
        <button className="arrow right" onClick={() => scrollBy(1)} aria-label="下一组">
          ›
        </button>

        <div className="carousel" ref={trackRef}>
          {moments.map((m) => {
            const isOpen = openId === m.slug;
            return (
              <div
                key={m.slug}
                className={`moment${isOpen ? ' is-open' : ''}`}
                onClick={() => setOpenId((cur) => (cur === m.slug ? null : m.slug))}
              >
                <div className={`moment-badge ${m.badgeColor ?? ''}`}>{m.date}</div>
                <div className="moment-card">
                  <div className="moment-cover">
                    <div className="moment-count">共 · {m.count} 张</div>
                    <MomentCover slug={m.slug} />
                  </div>
                  <div className="moment-title">{m.title}</div>
                  <div className="moment-meta">
                    <span>{m.semester}</span>
                    <span>点开展开 →</span>
                  </div>
                  {m.quote && (
                    <div className="moment-quote">
                      {m.quote.text}
                      <span className="who">
                        — {m.quote.who} / {m.quote.date}
                      </span>
                    </div>
                  )}
                </div>
                <div className="fan">
                  {m.photos.slice(0, 5).map((p, idx) => (
                    <div key={p.id} className="fan-photo">
                      <FanPhoto slug={m.slug} idx={idx} />
                      <div className="cap">{p.caption}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hint">
        ← 左右滑动　·　<em>点击</em>卡片让照片<em>扇形展开</em>　·　卡片底部的「」是那一天的<em>童言</em>
      </div>

      <div className={`backdrop${openId ? ' on' : ''}`} onClick={closeAll} />
    </>
  );
}
