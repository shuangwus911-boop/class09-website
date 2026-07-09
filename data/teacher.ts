// 班主任寄语 —— 每学年一封信（静态回退数据，线上以 KV 为准）
export type TeacherLetter = {
  id: string;
  year: string;        // 学年，如 "2025"
  yearLabel: string;   // 展示用，如 "2025 学年 · 一年级"
  title: string;       // 信的小标题，如 "写在开学"
  text: string;        // 正文
  teacher: string;     // 署名，如 "王老师"
  role: string;        // 身份，如 "班主任 · 语文"
  date: string;        // 落款日期，如 "2025.09"
  avatar?: string;     // 头像 URL（/images/...），前台展示用
  featured?: boolean;  // 是否首页展示
  status?: 'draft' | 'published';
};

export const TEACHER_LETTERS: TeacherLetter[] = [
  {
    id: 'letter-2025',
    year: '2025',
    yearLabel: '2025 学年 · 一年级',
    title: '写在开学',
    text: '亲爱的孩子们，欢迎来到一（09）班这个大家庭。愿你们在这里，既学会写好每一个字，也学会做一个温暖的人。六年很长，长到足够我们一起看四十六次花开；六年也很短，愿我们都不辜负每一天。',
    teacher: '何老师',
    role: '班主任',
    date: '2025.09',
    featured: true,
    status: 'published',
  },
];
