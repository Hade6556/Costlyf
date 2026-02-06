import { useI18n } from '../contexts/I18nContext'

export default function Help() {
  const { t } = useI18n()
  return (
    <div>
      <h1 className="dashboard-title">{t('dashboard.helpTitle')}</h1>
      <p className="dash-muted">{t('dashboard.helpSubtitle')}</p>
    </div>
  )
}
