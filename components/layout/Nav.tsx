'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SITE } from '@/data/site';

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="nav">
      <Link href="/" className="brand">
        <div className="brand-mark">{SITE.classCode}</div>
        <div>
          <div className="brand-jp">{SITE.brandJp}</div>
          <div className="brand-cn">{SITE.brandCn}</div>
        </div>
      </Link>
      <nav className="nav-links">
        <Link href="/">首页</Link>
        <Link href="/album">时光相册</Link>
        <Link href="/honors">荣耀墙</Link>
        <Link href="/teacher">班主任寄语</Link>
        <Link href="/voices">童言无忌</Link>
        <Link href="/capsule">时光胶囊</Link>
        <Link href="/timeline">时光轴</Link>
      </nav>
      <button
        className="nav-burger"
        onClick={() => setOpen(!open)}
        aria-label="菜单"
        aria-expanded={open}
      >
        <span />
        <span />
        <span />
      </button>
      {open && (
        <nav className="nav-mobile" onClick={() => setOpen(false)}>
          <Link href="/">首页</Link>
          <Link href="/album">时光相册</Link>
          <Link href="/honors">荣耀墙</Link>
          <Link href="/teacher">班主任寄语</Link>
          <Link href="/voices">童言无忌</Link>
          <Link href="/capsule">时光胶囊</Link>
          <Link href="/timeline">时光轴</Link>
        </nav>
      )}
    </div>
  );
}
