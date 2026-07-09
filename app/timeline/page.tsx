import Nav from '@/components/layout/Nav';
import Footer from '@/components/layout/Footer';
import { TIMELINE } from '@/data/timeline';
import { MOMENTS } from '@/data/moments';

export default function Page() {
  return (
    <>
      <Nav />
      <div className="sec-title" style={{ marginTop: 40 }}>
        <span className="sec-jp">TIMELINE · 六年历程</span>
        <span className="sec-cn">时 光 轴</span>
      </div>
      <div className="sec-note">从一年级到毕业 · 每一步都是故事</div>

      <div className="tl-vertical">
        {TIMELINE.map((node, idx) => {
          // Find moments belonging to this grade year
          const yearMoments = node.key === 'g1'
            ? MOMENTS.filter((m) => m.semester.includes('一'))
            : [];
          
          return (
            <div key={node.key} className={`tl-v-item tl-v-item--${node.status}`}>
              <div className="tl-v-dot" />
              <div className="tl-v-content">
                <div className="tl-v-year">{node.yearRange}</div>
                <div className="tl-v-grade">{node.grade}</div>
                <div className="tl-v-hint">{node.hint}</div>
                {yearMoments.length > 0 && (
                  <div className="tl-v-moments">
                    {yearMoments.map((m) => (
                      <div key={m.slug} className="tl-v-moment-chip">
                        <span className="tl-v-moment-date">{m.date.slice(5)}</span>
                        {m.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="tl-v-footer">
        <div className="tl-v-legend">
          <span><span className="dot c" /> 正在书写</span>
          <span><span className="dot f" /> 待续</span>
          <span><span className="dot d" /> 已归档</span>
        </div>
        <p>时光轴随着年级推进持续更新 · 每个节点点亮后将出现该学年的完整记录</p>
      </div>
      <Footer />
    </>
  );
}
