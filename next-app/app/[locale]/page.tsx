import { setRequestLocale } from 'next-intl/server';
import HomeContent from '@/components/HomeContent';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div>
      <HomeContent />
    </div>
  );
}
