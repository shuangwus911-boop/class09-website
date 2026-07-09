import { MOMENTS } from '@/data/moments';
import MomentDetail from './MomentDetail';

export function generateStaticParams() {
  return MOMENTS.map((m) => ({ slug: m.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MomentDetail slug={slug} />;
}
