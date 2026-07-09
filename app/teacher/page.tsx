'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { TEACHER_LETTERS as FALLBACK } from '@/data/teacher';
import type { TeacherLetter } from '@/data/teacher';

export default function Page() {
  const [letters, setLetters] = useState<TeacherLetter[]>(FALLBACK);
  const [activeYear, setActiveYear] = useState<string>('');

  useEffect(() => {
    fetch('/api/teacher').then(r => (r.ok ? r.json() : null)).then(d => {
      if (Array.isArray(d) && d.length) setLetters(d);
    });
  }, []);

  const years = Array.from(new Set(letters.map(l => l.year))).sort();
  const current = activeYear || years[years.length - 1] || '';
  const letter = letters.find(l => l.year === current) || letters[letters.length - 1];

  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">FROM TEACHER</span>
        <span className="sec-cn">班 主 任 寄 语</span>
      </div>
      <div className="sec-note">何老师写给孩子们的一封信</div>

      {years.length > 1 && (
        <div className="teacher-years-nav">
          {years.map(y => (
            <button key={y} className={`teacher-year${y === current ? ' active' : ''}`} onClick={() => setActiveYear(y)}>{y}</button>
          ))}
        </div>
      )}

      {letter ? (
        <div className="teacher-page">
          <div className="teacher-portrait">
            <div className="teacher-avatar">
              <svg viewBox="0 0 120 120">
                <rect width="120" height="120" fill="var(--paper-2)" />
                <circle cx="60" cy="46" r="24" fill="var(--accent)" />
                <path d="M22 116 Q60 70 98 116 Z" fill="var(--sage)" />
              </svg>
            </div>
            <div className="teacher-name">{letter.teacher}</div>
            <div className="teacher-role">{letter.role}</div>
          </div>
          <div className="teacher-body">
            <div className="teacher-eyebrow">— {letter.yearLabel} · {letter.title} —</div>
            <p className="teacher-quote">{letter.text}</p>
            <div className="teacher-sign">—— {letter.teacher} · {letter.date}</div>
          </div>
        </div>
      ) : (
        <div className="teacher-empty">寄语正在书写中，敬请期待</div>
      )}

      <Footer />
    </>
  );
}
