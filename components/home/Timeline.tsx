import Link from 'next/link';
import type { TimelineNode } from '@/data/timeline';

type Props = { nodes: TimelineNode[] };

// 节点在轴上从 8% 开始，均匀分布到 96%
function positions(n: number): number[] {
  if (n === 1) return [50];
  const start = 8;
  const end = 96;
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + i * step);
}

export default function Timeline({ nodes }: Props) {
  const lefts = positions(nodes.length);

  return (
    <div className="tl">
      <div className="tl-line">
        <div className="tl-inner">
          <div className="tl-track" />

          {nodes.map((node, i) => {
            const left = `${lefts[i]}%`;
            const above = i % 2 === 1; // 交替上下
            return (
              <div key={node.key}>
                <div
                  className={`tl-node ${node.status}`}
                  style={{ left }}
                  aria-label={`${node.yearRange} ${node.grade}`}
                />
                <div
                  className={`tl-slot ${above ? 'above' : 'below'} ${node.status === 'current' ? 'current' : ''}`}
                  style={{ left }}
                >
                  {above && (
                    <>
                      <div className="info">
                        <div className="tl-year">{node.yearRange}</div>
                        <div className="tl-grade">{node.grade}</div>
                        <div className="tl-hint">
                          {node.status === 'current' ? <em>{node.hint}</em> : node.hint}
                        </div>
                      </div>
                      <div className="connector" />
                    </>
                  )}
                  {!above && (
                    <>
                      <div className="connector" />
                      <div className="info">
                        <div className="tl-year">{node.yearRange}</div>
                        <div className="tl-grade">{node.grade}</div>
                        <div className="tl-hint">
                          {node.status === 'current' ? (
                            <>
                              <em>{node.hint}</em>
                            </>
                          ) : (
                            node.hint
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tl-foot">
        <div className="legend">
          <span>
            <span className="dot d" />
            已过
          </span>
          <span>
            <span className="dot c" />
            正在
          </span>
          <span>
            <span className="dot f" />
            待写
          </span>
        </div>
        <Link href="/timeline">点节点跳转到该学年归档 →</Link>
      </div>
    </div>
  );
}
