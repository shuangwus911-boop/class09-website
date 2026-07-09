import Link from 'next/link';
import type { Honor } from '@/data/honors';
import HonorMedal from '@/components/illust/HonorMedal';

type Props = { honor: Honor };

export default function LatestHonor({ honor }: Props) {
  return (
    <div className="honor">
      <Link href="/honors" className="honor-more">
        看 全 部 荣 誉 →
      </Link>

      <div className="honor-medal">
        <HonorMedal />
        <div className="honor-medal-tag">CLASS HONOR · {honor.date.slice(0, 4)}</div>
      </div>

      <div className="honor-body">
        <div className="honor-eyebrow">— 最新一枚 · {honor.date.slice(5)} 授予 —</div>
        <h3 className="honor-title">{honor.title}</h3>
        <div className="honor-sub">{honor.subtitle}</div>
        <p className="honor-desc">{honor.description}</p>
        <div className="honor-meta">
          <div>
            颁发时间<strong>{honor.date}</strong>
          </div>
          <div>
            颁发方<strong>{honor.awardedBy}</strong>
          </div>
          <div>
            荣誉编号<strong>{honor.serial}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
