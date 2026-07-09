'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { MOMENTS } from '@/data/moments';
import type { Moment } from '@/data/moments';

export default function MomentDetail({ slug }: { slug: string }) {
  const fallback = MOMENTS.find((m) => m.slug === slug);
  const [moment, setMoment] = useState<Moment | null>(fallback || null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/moments/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setMoment(d);
      });
  }, [slug]);

  if (!moment) {
    return (
      <>
        <Nav />
        <div className="detail-empty">
          <p>未找到该时刻</p>
          <a href="/album/">← 返回相册</a>
        </div>
        <Footer />
      </>
    );
  }

  const photosWithSrc = moment.photos.filter((p) => p.src);
  const hasPhotos = photosWithSrc.length > 0;

  return (
    <>
      <Nav />

      <div className="detail-header">
        <a href="/album/" className="detail-back">← 全部时刻</a>
        <div className={`detail-badge detail-badge--${moment.badgeColor || 'red'}`}>
          {moment.semester}
        </div>
      </div>

      <div className="detail-hero">
        <h1 className="detail-title">{moment.title}</h1>
        <div className="detail-meta">
          <span>{moment.date}</span>
          <span>·</span>
          <span>共 {moment.count} 张照片</span>
        </div>
      </div>

      {hasPhotos ? (
        <div className="detail-grid">
          {photosWithSrc.map((photo) => (
            <div
              key={photo.id}
              className="detail-photo"
              onClick={() => setLightbox(photo.src!)}
            >
              <img src={photo.src} alt={photo.caption} loading="lazy" />
              {photo.caption && (
                <div className="detail-photo-cap">{photo.caption}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="detail-placeholder">
          <div className="detail-placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <p>照片正在整理中，敬请期待</p>
          <p className="detail-placeholder-hint">
            管理员可在后台「图片管理」中上传照片
          </p>
        </div>
      )}

      {moment.quote && (
        <div className="detail-quote">
          <div className="detail-quote-mark">「</div>
          <p className="detail-quote-text">{moment.quote.text}</p>
          <div className="detail-quote-footer">
            <span>— {moment.quote.who}</span>
            <span>{moment.quote.date}</span>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="detail-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
          <button className="detail-lightbox-close" onClick={() => setLightbox(null)}>×</button>
        </div>
      )}

      <Footer />
    </>
  );
}
