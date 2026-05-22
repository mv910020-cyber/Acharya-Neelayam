import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCategoryLabel, getProductName } from '../content/siteCopy';
import { useLanguage } from '../context/LanguageContext';
import { useStore } from '../context/StoreContext';
import ProductCard from './ProductCard';

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const { language, copy } = useLanguage();
  const {
    products,
    selectedProduct,
    productLoading,
    error,
    fetchProductById,
    addToCart,
  } = useStore();

  useEffect(() => {
    if (productId) {
      void fetchProductById(productId);
    }
  }, [fetchProductById, productId]);

  if (productLoading) {
    return (
      <section className="page-shell">
        <div className="status-panel">{copy.common.loadingDetails}</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-shell">
        <div className="status-panel status-panel-error">
          {copy.common.error}: {error}
        </div>
      </section>
    );
  }

  if (!selectedProduct) {
    return (
      <section className="page-shell">
        <div className="status-panel">
          {copy.detail.unavailable}{' '}
          <Link to="/products">{copy.detail.backToProducts}</Link>
        </div>
      </section>
    );
  }

  const productName = getProductName(selectedProduct.id, selectedProduct.name, language);
  const categoryName = getCategoryLabel(selectedProduct.category, language);
  const relatedProducts = products
    .filter(
      (product) =>
        product.id !== selectedProduct.id && product.category === selectedProduct.category
    )
    .slice(0, 4);

  return (
    <section className="page-shell">
      <Link to="/products" className="detail-back-link">
        {copy.detail.backToProducts}
      </Link>

      <div className="detail-hero">
        <div className="detail-media">
          <img src={selectedProduct.imageUrl} alt={productName} />
        </div>

        <div className="detail-copy">
          <p className="eyebrow">{categoryName}</p>
          <h1>{productName}</h1>
          <p className="lead">{selectedProduct.description}</p>

          <div className="detail-badges">
            <span>{selectedProduct.badge}</span>
            <span>{categoryName}</span>
            <span>
              {selectedProduct.isCollection
                ? copy.detail.collection
                : copy.detail.product}
            </span>
          </div>

          <p className="detail-note">{selectedProduct.useCase}</p>

          <div className="detail-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => addToCart(selectedProduct.id)}
            >
              {copy.common.addToCart}
            </button>
            <Link
              to={`/contact?product=${selectedProduct.id}`}
              className="secondary-button"
            >
              {copy.common.requestItem}
            </Link>
          </div>

          <div className="detail-tag-list">
            {selectedProduct.tags.map((tag) => (
              <span key={tag} className="detail-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {relatedProducts.length ? (
        <div className="related-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{copy.detail.moreInCategory}</p>
              <h2>{copy.detail.keepBrowsing(categoryName)}</h2>
            </div>
          </div>

          <div className="product-grid">
            {relatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
