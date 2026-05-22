import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

type CollectionIconName = 'bell' | 'flame' | 'gift' | 'star';

function CollectionIcon({ icon }: { icon: CollectionIconName }) {
  const iconPaths: Record<CollectionIconName, ReactNode> = {
    bell: (
      <>
        <path d="M12 4.8a4.6 4.6 0 0 1 4.6 4.6v2.2c0 1.2.3 2.3.9 3.3l1 1.7H5.5l1-1.7c.6-1 .9-2.1.9-3.3V9.4A4.6 4.6 0 0 1 12 4.8Z" />
        <path d="M10.2 19a1.8 1.8 0 0 0 3.6 0" />
      </>
    ),
    flame: (
      <>
        <path d="M13 3.8c.7 2-.1 3.3-1.2 4.6c-1.2 1.4-2.4 2.6-2.4 4.7a3 3 0 0 0 6 0c0-1.3-.6-2.4-1.7-3.6c-1.2-1.3-1.8-2.8-.7-5.7Z" />
        <path d="M12.1 10.2c-1.6 1.1-2.4 2.2-2.4 3.7a2.3 2.3 0 0 0 4.6 0c0-1.1-.5-2.1-2.2-3.7Z" />
      </>
    ),
    gift: (
      <>
        <path d="M5.4 10.2h13.2v8.8H5.4z" />
        <path d="M4.2 7.1h15.6v3.1H4.2z" />
        <path d="M12 7.1v11.9" />
        <path d="M9.4 6.8c-1.1 0-2-.8-2-1.9c0-1 .8-1.8 1.8-1.8c1.7 0 2.8 2 2.8 4.1V7.5c0-2-1.2-4.1-2.8-4.1" />
        <path d="M14.6 6.8c1.1 0 2-.8 2-1.9c0-1-.8-1.8-1.8-1.8c-1.7 0-2.8 2-2.8 4.1V7.5c0-2 1.2-4.1 2.8-4.1" />
      </>
    ),
    star: (
      <>
        <path d="m12 3.9l2.3 4.7l5.2.8l-3.7 3.6l.9 5.1L12 15.8l-4.7 2.4l.9-5.1L4.5 9.4l5.2-.8Z" />
      </>
    ),
  };

  return (
    <span className="home-collection-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">{iconPaths[icon]}</svg>
    </span>
  );
}

export default function HomePage() {
  const { copy, language } = useLanguage();
  const mantraMeaning =
    language === 'te'
      ? 'Shubham, kshemam, arogyam, aishvaryam kalagali'
      : 'May there be auspiciousness, welfare, health and prosperity';
  const collectionCards = [
    {
      ...copy.home.collections[1],
      imageUrl: '/products/feature-brass-vessels.jpg',
      category: 'Brass Items',
      icon: 'bell' as const,
    },
    {
      ...copy.home.collections[0],
      imageUrl: '/products/feature-aarti-essentials.jpg',
      category: 'Puja Samagri',
      icon: 'flame' as const,
    },
    {
      ...copy.home.collections[2],
      imageUrl: '/products/feature-gift-sets.jpg',
      category: 'Return Gifts',
      icon: 'gift' as const,
    },
    {
      ...copy.home.collections[3],
      imageUrl: '/products/feature-deity-decor.jpg',
      category: 'Festival Special Items',
      icon: 'star' as const,
    },
  ];

  return (
    <div className="home-page">
      <section className="hero-shell">
        <div className="hero-content">
          <p className="hero-devotional-line">{copy.home.eyebrow}</p>
          <h1 className="hero-title">{copy.home.title}</h1>
          <p className="hero-copy">{copy.home.copy}</p>

          <div className="hero-actions">
            <Link to="/products" className="primary-button">
              {copy.common.viewProducts}
            </Link>
          </div>
        </div>
      </section>

      <section className="home-mantra-band">
        <span className="home-mantra-divider" />
        <h2 className="home-mantra-quote">{copy.home.mantra}</h2>
        <p className="home-mantra-meaning">{mantraMeaning}</p>
        <span className="home-mantra-divider" />
      </section>

      <section className="home-collections-shell">
        <div className="home-collections-grid">
          {collectionCards.map((card) => (
            <Link
              key={card.title}
              to={`/products?category=${encodeURIComponent(card.category)}`}
              className="home-collection-card"
            >
              <img src={card.imageUrl} alt={card.title} className="home-collection-image" />
              <div className="home-collection-body">
                <CollectionIcon icon={card.icon} />
                <h2>{card.title}</h2>
                <p>{card.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
