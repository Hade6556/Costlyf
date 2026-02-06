import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useI18n } from '../contexts/I18nContext'

export default function Wallet() {
  const { t, locale } = useI18n()
  const [balance] = useState('0')
  const [upcoming] = useState('0')
  const [monthDate, setMonthDate] = useState(() => new Date())
  const monthLabel = monthDate.toLocaleString(locale || 'en', { month: 'long', year: 'numeric' })
  const prevMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  return (
    <main className="dashboard-main dashboard-main--wallet">
      <section className="wallet-screen">
        <Link to="/home" className="wallet-back" aria-label={t('dashboard.backToHome')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </Link>

        <h1 className="wallet-title">{t('dashboard.walletTitle')}</h1>
        <p className="wallet-balance-amount">{balance}€</p>

        <div className="wallet-actions">
          <button type="button" className="wallet-action-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            <span>{t('dashboard.topUp')}</span>
          </button>
          <button type="button" className="wallet-action-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M7 7h10v10" /></svg>
            <span>{t('dashboard.bankTransfer')}</span>
          </button>
        </div>

        <div className="wallet-card wallet-card--upcoming">
          <div className="wallet-card-main">
            <span className="wallet-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </span>
            <div className="wallet-card-text">
              <span className="wallet-card-title">{t('dashboard.upcomingBalance')}</span>
              <span className="wallet-card-sub">{t('dashboard.inNext30Days')}</span>
            </div>
          </div>
          <div className="wallet-card-right">
            <span className="wallet-card-value">+ {upcoming}€</span>
          </div>
        </div>

        <div className="wallet-card wallet-card--history">
          <div className="wallet-history-head">
            <h2 className="wallet-history-title">{t('dashboard.history')}</h2>
            <div className="wallet-month-nav">
              <button type="button" className="wallet-month-btn" aria-label={t('dashboard.previous')} onClick={prevMonth}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <span className="wallet-month-label">{monthLabel}</span>
              <button type="button" className="wallet-month-btn" aria-label={t('dashboard.nextLabel')} onClick={nextMonth}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          </div>
          <div className="wallet-receipt wallet-receipt--empty">
            <p className="wallet-history-empty">{t('dashboard.noHistory')}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
