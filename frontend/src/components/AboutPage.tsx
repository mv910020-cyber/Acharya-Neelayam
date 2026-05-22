import { useLanguage } from '../context/LanguageContext';

export default function AboutPage() {
  const { copy } = useLanguage();

  return (
    <section className="page-shell">
      <div className="catalog-intro">
        <p className="eyebrow">{copy.about.eyebrow}</p>
        <h1>{copy.about.title}</h1>
        <p className="lead">{copy.about.lead}</p>
      </div>

      <div className="story-grid">
        {copy.about.cards.map((card) => (
          <article key={card.title} className="story-card">
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
