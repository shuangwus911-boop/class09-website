// 关键时刻数据源。每一条对应首页时光相册的一张卡片。
// 后续接入 CMS 后，这个文件可以替换成 fetch/CMS 拉取。

export type Photo = {
  id: string;
  caption: string;
  // 静态资源路径（放到 /public/images/<slug>/）或未来接入 R2 后的 URL
  src?: string;
};

export type Quote = {
  text: string;
  who: string;
  date: string; // MM.DD
};

export type Moment = {
  slug: string;
  title: string;
  date: string;       // 2025.09.01
  semester: string;   // 2025 秋 · 一上
  count: number;      // 该时刻收录的总照片数
  badgeColor?: 'red' | 'green' | 'orange' | 'blue' | 'purple';
  cover: string;      // 封面 svg key，映射到 CoverIllust
  photos: Photo[];    // 扇形展开时前几张
  quote?: Quote;      // 那一天的童言
};

export const MOMENTS: Moment[] = [
  {
    slug: 'first-day',
    title: '开学第一天',
    date: '2025.09.01',
    semester: '2025 秋 · 一上',
    count: 12,
    badgeColor: 'red',
    cover: 'firstDay',
    photos: [
      { id: 'p1', caption: '校门合影' },
      { id: 'p2', caption: '教室' },
      { id: 'p3', caption: '升旗' },
      { id: 'p4', caption: '第一堂课' },
      { id: 'p5', caption: '新朋友' },
    ],
    quote: {
      text: '妈妈，老师说的普通话跟外婆的不一样，我要学谁的？',
      who: '朵朵',
      date: '09.01',
    },
  },
  {
    slug: 'mid-autumn',
    title: '中秋游园会',
    date: '2025.09.28',
    semester: '2025 秋 · 一上',
    count: 18,
    badgeColor: 'green',
    cover: 'midAutumn',
    photos: [
      { id: 'p1', caption: '月亮' },
      { id: 'p2', caption: '月饼' },
      { id: 'p3', caption: '灯笼' },
      { id: 'p4', caption: '游园' },
      { id: 'p5', caption: '合影' },
    ],
    quote: {
      text: '月亮是被谁咬了一口？肯定不是我，我今天没吃月饼。',
      who: '小满',
      date: '09.28',
    },
  },
  {
    slug: 'autumn-outing',
    title: '秋游 · 龙井山径',
    date: '2025.10.15',
    semester: '2025 秋 · 一上',
    count: 24,
    badgeColor: 'orange',
    cover: 'autumnOuting',
    photos: [
      { id: 'p1', caption: '大银杏' },
      { id: 'p2', caption: '山径' },
      { id: 'p3', caption: '落叶' },
      { id: 'p4', caption: '牵手' },
      { id: 'p5', caption: '野餐' },
    ],
    quote: {
      text: '我的水壶跟树叶一样大，我拿不动了，可以请老师帮我抱一下吗？',
      who: '阿宝',
      date: '10.15',
    },
  },
  {
    slug: 'new-year',
    title: '元旦联欢会',
    date: '2025.12.31',
    semester: '2025 冬 · 一上',
    count: 15,
    badgeColor: 'blue',
    cover: 'newYear',
    photos: [
      { id: 'p1', caption: '开场' },
      { id: 'p2', caption: '舞蹈' },
      { id: 'p3', caption: '合唱' },
      { id: 'p4', caption: '彩带' },
      { id: 'p5', caption: '大合影' },
    ],
    quote: {
      text: '明年我就长到 120 厘米了，那样能坐过山车了吗？',
      who: '小豆',
      date: '12.31',
    },
  },
  {
    slug: 'spring-outing',
    title: '春游 · 樱花小径',
    date: '2026.04.10',
    semester: '2026 春 · 一下',
    count: 20,
    badgeColor: 'purple',
    cover: 'springOuting',
    photos: [
      { id: 'p1', caption: '樱花' },
      { id: 'p2', caption: '草地' },
      { id: 'p3', caption: '合影' },
      { id: 'p4', caption: '野餐布' },
      { id: 'p5', caption: '花瓣雨' },
    ],
    quote: {
      text: '樱花掉下来的时候，是不是它想跟风做个朋友？',
      who: '果果',
      date: '04.10',
    },
  },
  {
    slug: 'childrens-day',
    title: '六一儿童节',
    date: '2026.06.01',
    semester: '2026 春 · 一下',
    count: 30,
    badgeColor: 'red',
    cover: 'childrensDay',
    photos: [
      { id: 'p1', caption: '庆典' },
      { id: 'p2', caption: '气球' },
      { id: 'p3', caption: '表演' },
      { id: 'p4', caption: '小演员' },
      { id: 'p5', caption: '奖状' },
    ],
    quote: {
      text: '长大以后我要当"发明糖果的科学家"，最重要一条：不能有蔬菜味。',
      who: '团团',
      date: '06.01',
    },
  },
];
