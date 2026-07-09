// 集体荣誉。首页只展示最新一条，全部展示在 /honors 页面。

export type Honor = {
  id: string;
  title: string;      // "文明礼仪示范班"
  subtitle: string;   // 学年 / 学期
  date: string;       // 2026.06.28
  awardedBy: string;  // 颁发单位
  serial: string;     // 编号
  description: string;
  featured?: boolean; // 是否首页展示（一般 latest = true）
};

export const HONORS: Honor[] = [
  {
    id: 'h-2026-spring',
    title: '"文明礼仪示范班"',
    subtitle: '杭州文澜实验小学 · 2025—2026 学年度 · 春学期',
    date: '2026.06.28',
    awardedBy: '校德育处',
    serial: 'WL-2026-春-09',
    description:
      '春学期里，四十六位小朋友第一次学会排队、鞠躬、说"请"和"谢谢"。走廊上没有奔跑，午餐时安安静静，每天离校前把小椅子推回桌下——于是我们收到了这枚金色小徽章。',
    featured: true,
  },
];

export function getLatestHonor() {
  return HONORS.find((h) => h.featured) ?? HONORS[0];
}
