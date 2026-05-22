import { useLanguage } from '../context/LanguageContext';
import { useStore } from '../context/StoreContext';
import ProductCard from './ProductCard';

export default function AuspiciousDaysPage() {
  const { copy } = useLanguage();
  const { products } = useStore();
  const festivalProducts = products
    .filter((product) => product.category === 'Festival Special Items')
    .slice(0, 4);

  return (
    <section className="page-shell">
      <div className="catalog-intro">
        <p className="eyebrow">{copy.auspicious.eyebrow}</p>
        <h1>{copy.auspicious.title}</h1>
        <p className="lead">{copy.auspicious.lead}</p>
      </div>

      <div className="story-grid">
        {copy.auspicious.planningNotes.map((note) => (
          <article key={note.title} className="story-card">
            <h3>{note.title}</h3>
            <p>{note.text}</p>
          </article>
        ))}
      </div>

      <div className="section-shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{copy.auspicious.seasonalEyebrow}</p>
            <h2>{copy.auspicious.seasonalTitle}</h2>
          </div>
        </div>

        <div className="product-grid">
          {festivalProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
