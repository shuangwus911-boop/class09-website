import type { Metadata } from 'next';
import './globals.css';
import { SITE } from '@/data/site';

export const metadata: Metadata = {
  title: `${SITE.className} · ${SITE.school}`,
  description: SITE.slogan,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="page-outer">
          <div className="page-shell">{children}</div>
        </div>
      </body>
    </html>
  );
}
