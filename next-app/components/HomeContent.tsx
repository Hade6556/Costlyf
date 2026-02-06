'use client';

import { useTranslations } from 'next-intl';

export default function HomeContent() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  return (
    <>
      <h1>{tCommon('welcome')}</h1>
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
    </>
  );
}
