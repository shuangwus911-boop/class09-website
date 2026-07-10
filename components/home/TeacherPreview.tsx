'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TEACHER_LETTERS as FALLBACK } from '@/data/teacher';
import type { TeacherLetter } from '@/data/teacher';

export default function TeacherPreview() {
  const [letters, setLetters] = useState<TeacherLetter[]>(FALLBACK);
  const [globalAvatar, setGlobalAvatar] = useState('');

  useEffect(() => {
    fetch('/api/teacher').then(r => (r.ok ? r.json() : null)).then(d => {
      if (Array.isArray(d) && d.length) setLetters(d);
    });
    fetch('/api/teacher_avatar').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.avatar) setGlobalAvatar(d.avatar);
    });
  }, []);

  const letter = letters.find(l => l.featured) || letters[letters.length - 1];
  if (!letter) return null;

  const avatarUrl = globalAvatar || '';

  return (
    <div className="teacher">
      <Link href="/teacher" className="teacher-more">看 历 年 寄 语 →</Link>
      <div className="teacher-portrait">
        <div className="teacher-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={letter.teacher} />
          ) : (
            <svg viewBox="0 0 120 120">
              <rect width="120" height="120" fill="var(--paper-2)" />
              <circle cx="60" cy="46" r="24" fill="var(--accent)" />
              <path d="M22 116 Q60 70 98 116 Z" fill="var(--sage)" />
            </svg>
          )}
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
  );
}
