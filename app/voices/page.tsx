import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { MOMENTS } from '@/data/moments';

// Collect all quotes from moments
const ALL_QUOTES = MOMENTS
  .filter((m) => m.quote)
  .map((m) => ({
    text: m.quote!.text,
    who: m.quote!.who,
    date: m.quote!.date,
    moment: m.title,
    slug: m.slug,
    badgeColor: m.badgeColor,
  }));

export default function Page() {
  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">VOICES · 小小旁白</span>
        <span className="sec-cn">童 言 无 忌</span>
      </div>
      <div className="sec-note">孩子们的奇思与天真话语 · 收集于每一个关键时刻</div>

      <div className="voices-grid">
        {ALL_QUOTES.map((q, idx) => (
          <div key={idx} className={`voice-card voice-card--${q.badgeColor || 'red'}`}>
            <div className="voice-card-mark">「</div>
            <p className="voice-card-text">{q.text}</p>
            <div className="voice-card-footer">
              <span className="voice-card-who">— {q.who}</span>
              <span className="voice-card-from">{q.moment} · {q.date}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="voices-note">
        童言由老师与家长在活动中记录 · 持续更新中
      </div>
      <Footer />
    </>
  );
}
