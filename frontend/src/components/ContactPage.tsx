import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  contactProfile,
  getContactProfileInitials,
  getPhoneDigits,
} from '../content/contactProfile';
import { getProductName } from '../content/siteCopy';
import { useLanguage } from '../context/LanguageContext';
import { useStore } from '../context/StoreContext';

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const { language, copy } = useLanguage();
  const { products, submitInquiry, inquirySubmitting, error } = useStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const selectedProductId = searchParams.get('product') || '';
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const defaultMessage = selectedProduct
    ? `Please share availability for ${selectedProduct.name}.`
    : '';
  const messageValue = message ?? defaultMessage;
  const selectedProductName = selectedProduct
    ? getProductName(selectedProduct.id, selectedProduct.name, language)
    : copy.contact.fields.generalInquiry;

  const profileInitials = getContactProfileInitials(contactProfile.contactPerson);
  const phoneDigits = getPhoneDigits(contactProfile.phone);
  const detailRows = [
    {
      label: copy.contact.detailLabels.owner,
      value: contactProfile.contactPerson,
    },
    {
      label: copy.contact.detailLabels.phone,
      value: contactProfile.phone,
    },
    {
      label: copy.contact.detailLabels.email,
      value: contactProfile.email,
    },
    {
      label: copy.contact.detailLabels.address,
      value: `${contactProfile.addressLineOne[language]}, ${contactProfile.addressLineTwo[language]}`,
    },
    {
      label: copy.contact.detailLabels.hours,
      value: contactProfile.hours[language],
    },
    {
      label: copy.contact.detailLabels.response,
      value: contactProfile.responseTime[language],
    },
  ];
  const quickActions = [
    {
      label: copy.contact.actions.call,
      href: `tel:${phoneDigits}`,
      className: 'secondary-button',
      external: false,
    },
    {
      label: copy.contact.actions.email,
      href: `mailto:${contactProfile.email}`,
      className: 'secondary-button',
      external: false,
    },
  ];

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(false);

    try {
      await submitInquiry({
        name,
        phone,
        message: messageValue,
        productId: selectedProduct?.id,
      });

      setSubmitted(true);
      setName('');
      setPhone('');
      setMessage(null);
    } catch {
      setSubmitted(false);
    }
  };

  return (
    <section className="page-shell contact-page-shell">
      <div className="contact-hero-card">
        <div className="contact-hero-copy">
          <p className="eyebrow">{copy.contact.eyebrow}</p>
          <h1>{copy.contact.title}</h1>
          <p className="lead">{copy.contact.lead}</p>
        </div>

        <div className="contact-hero-badge">
          <span>{copy.contact.quickReply}</span>
          <strong>{contactProfile.responseTime[language]}</strong>
        </div>
      </div>

      <div className="contact-page-grid">
        <aside className="contact-profile-card">
          <p className="contact-profile-kicker">{copy.contact.profileTitle}</p>

          <div className="contact-profile-header">
            <div className="contact-avatar" aria-hidden="true">
              {profileInitials}
            </div>

            <div className="contact-profile-copy">
              <p className="contact-role">{contactProfile.role[language]}</p>
              <h2>{contactProfile.businessName}</h2>
              <strong>{contactProfile.contactPerson}</strong>
            </div>
          </div>

          <div className="contact-detail-list">
            {detailRows.map((row) => (
              <div key={row.label} className="contact-detail-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>

          <div className="contact-action-grid">
            {quickActions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                className={`${action.className} contact-action-button`}
                target={action.external ? '_blank' : undefined}
                rel={action.external ? 'noreferrer' : undefined}
              >
                {action.label}
              </a>
            ))}
          </div>

          <p className="contact-profile-note">{contactProfile.serviceNote[language]}</p>
        </aside>

        <div className="contact-form-stack">
          <div className="story-grid contact-story-grid">
            {copy.contact.cards.map((card) => (
              <article key={card.title} className="story-card">
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>

          <form className="contact-form contact-form-card" onSubmit={handleSubmit}>
            <div className="contact-form-heading">
              <h2>{copy.contact.formTitle}</h2>
              <p>{copy.contact.formLead}</p>
            </div>

            <label className="form-field">
              <span>{copy.contact.fields.name}</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={copy.contact.fields.namePlaceholder}
                required
              />
            </label>

            <label className="form-field">
              <span>{copy.contact.fields.phone}</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={copy.contact.fields.phonePlaceholder}
                required
              />
            </label>

            <label className="form-field">
              <span>{copy.contact.fields.selectedProduct}</span>
              <input type="text" value={selectedProductName} readOnly />
            </label>

            <label className="form-field">
              <span>{copy.contact.fields.requirement}</span>
              <textarea
                value={messageValue}
                onChange={(event) => setMessage(event.target.value)}
                rows={6}
                placeholder={copy.contact.fields.requirementPlaceholder}
                required
              />
            </label>

            <div className="contact-guidance-card">
              <h3>{copy.contact.guidanceTitle}</h3>
              <ul className="contact-guidance-list">
                {copy.contact.guidancePoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>

            {error ? (
              <div className="status-panel status-panel-error">
                {copy.common.error}: {error}
              </div>
            ) : null}
            {submitted ? (
              <div className="status-panel status-panel-success">
                {copy.contact.success}
              </div>
            ) : null}

            <button type="submit" className="primary-button" disabled={inquirySubmitting}>
              {inquirySubmitting ? copy.contact.sending : copy.contact.send}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
