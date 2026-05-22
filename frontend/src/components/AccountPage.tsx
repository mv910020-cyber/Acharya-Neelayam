import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { language, setLanguage, copy } = useLanguage();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const detailRows = [
    {
      label: copy.account.fields.name,
      value: user?.full_name || user?.username || '-',
    },
    {
      label: copy.account.fields.username,
      value: user?.username || '-',
    },
    {
      label: copy.account.fields.email,
      value: user?.email || '-',
    },
  ];

  return (
    <section className="page-shell">
      <div className="catalog-intro">
        <p className="eyebrow">{copy.account.eyebrow}</p>
        <h1>{copy.account.title}</h1>
        <p className="lead">{copy.account.lead}</p>
      </div>

      <div className="account-page-grid">
        <article className="contact-profile-card account-card">
          <p className="contact-profile-kicker">{copy.account.profileTitle}</p>

          <div className="contact-detail-list">
            {detailRows.map((row) => (
              <div key={row.label} className="contact-detail-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="contact-form contact-form-card account-card">
          <div className="contact-form-heading">
            <h2>{copy.account.preferencesTitle}</h2>
            <p>{copy.account.languageLead}</p>
          </div>

          <div
            className="language-pills account-language-pills"
            aria-label={copy.account.preferencesTitle}
          >
            <button
              type="button"
              className={`language-pill ${
                language === 'te' ? 'language-pill-active' : ''
              }`}
              onClick={() => setLanguage('te')}
            >
              {copy.header.languages.te}
            </button>
            <button
              type="button"
              className={`language-pill ${
                language === 'en' ? 'language-pill-active' : ''
              }`}
              onClick={() => setLanguage('en')}
            >
              {copy.header.languages.en}
            </button>
          </div>

          <div className="account-actions">
            <Link to="/orders" className="primary-button account-orders-link">
              My Orders
            </Link>
            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
              title={copy.account.logoutLabel}
            >
              {copy.account.logoutLabel}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
