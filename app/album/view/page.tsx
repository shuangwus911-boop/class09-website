'use client';

// 静态壳页：/album/view/?slug=xxx
// 静态导出模式下 [slug] 只能预生成代码里写死的时刻；后台 KV 新增的时刻没有对应静态 HTML 会 404。
// 此壳页固定存在，通过查询参数 ?slug= 在运行时加载任意时刻，彻底避免死链。

import MomentDetail from '../[slug]/MomentDetail';

export default function AlbumViewPage() {
  return <MomentDetail />;
}
