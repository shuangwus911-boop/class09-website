// 六年时光轴。表示班级从 2025 秋入学到 2031 夏毕业。
// 节点状态不写死，按当前日期推导，每年 9 月自动前进一格。

export type TimelineStatus = 'done' | 'current' | 'future';

export type TimelineNode = {
  key: string;
  yearRange: string;
  grade: string;
  status: TimelineStatus;
  hint: string;
  slug?: string; // 未来跳转到 /year/[slug]
};

type GradeDef = {
  key: string;
  yearRange: string;
  grade: string;
  startYear: number;
  slug?: string;
  hint?: string; // 只有毕业节点用固定文案
};

const GRADES: GradeDef[] = [
  { key: 'g1', yearRange: '2025—2026', grade: '一 年 级', startYear: 2025, slug: 'g1' },
  { key: 'g2', yearRange: '2026—2027', grade: '二 年 级', startYear: 2026, slug: 'g2' },
  { key: 'g3', yearRange: '2027—2028', grade: '三 年 级', startYear: 2027, slug: 'g3' },
  { key: 'g4', yearRange: '2028—2029', grade: '四 年 级', startYear: 2028, slug: 'g4' },
  { key: 'g5', yearRange: '2029—2030', grade: '五 年 级', startYear: 2029, slug: 'g5' },
  { key: 'g6', yearRange: '2030—2031', grade: '六 年 级', startYear: 2030, slug: 'g6' },
  { key: 'graduation', yearRange: '2031 夏', grade: '毕 业', startYear: 2031, hint: '开启时间胶囊' },
];

// 学年以 9 月 1 日为界，8 月及以前仍算上一个学年
export function academicStartYear(now: Date): number {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

const ORDINALS = ['一', '二', '三', '四', '五', '六'];

// 照片的学期名形如「2026 秋 · 二上」，从里面认出年级；认不出返回 null
export function gradeKeyOfSemester(semester: string): string | null {
  const hit = semester.match(/([一二三四五六])[上下]/);
  return hit ? `g${ORDINALS.indexOf(hit[1]) + 1}` : null;
}

export function resolveTimeline(now: Date): TimelineNode[] {
  const current = academicStartYear(now);
  return GRADES.map(g => {
    const status: TimelineStatus =
      g.startYear < current ? 'done' : g.startYear === current ? 'current' : 'future';
    return {
      key: g.key,
      yearRange: g.yearRange,
      grade: g.grade,
      slug: g.slug,
      status,
      hint: g.hint ?? (status === 'done' ? '已归档' : status === 'current' ? '正在书写' : '留待长大'),
    };
  });
}
