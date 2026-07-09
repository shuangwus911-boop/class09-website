// 六年时光轴。表示班级从 2025 秋入学到 2032 夏毕业。

export type TimelineStatus = 'done' | 'current' | 'future';

export type TimelineNode = {
  key: string;
  yearRange: string;
  grade: string;
  status: TimelineStatus;
  hint: string;
  slug?: string; // 未来跳转到 /year/[slug]
};

export const TIMELINE: TimelineNode[] = [
  { key: 'g1', yearRange: '2025—2026', grade: '一 年 级', status: 'current', hint: '正在书写', slug: 'g1' },
  { key: 'g2', yearRange: '2026—2027', grade: '二 年 级', status: 'future', hint: '从今天出发', slug: 'g2' },
  { key: 'g3', yearRange: '2027—2028', grade: '三 年 级', status: 'future', hint: '留待长大', slug: 'g3' },
  { key: 'g4', yearRange: '2028—2029', grade: '四 年 级', status: 'future', hint: '留待长大', slug: 'g4' },
  { key: 'g5', yearRange: '2029—2030', grade: '五 年 级', status: 'future', hint: '留待长大', slug: 'g5' },
  { key: 'g6', yearRange: '2030—2031', grade: '六 年 级', status: 'future', hint: '留待长大', slug: 'g6' },
  { key: 'graduation', yearRange: '2032 夏', grade: '毕 业', status: 'future', hint: '开启时间胶囊' },
];
