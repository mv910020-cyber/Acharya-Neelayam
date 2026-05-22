import { Link } from 'react-router-dom';
import { getProductName } from '../content/siteCopy';
import { useLanguage } from '../context/LanguageContext';
import { type Product } from '../context/StoreContext';
import { useProductActions } from '../hooks/useProductActions';
import { formatProductPrice, formatProductReviews } from '../utils/productDisplay';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { language, copy } = useLanguage();
  const { handleAddToCart, handleBuyNow } = useProductActions();
  const productName = getProductName(product.id, product.name, language);

  return (
    <article className="product-card">
      <div className="product-card-image-container">
        <Link to={`/products/${product.id}`} className="product-card-image-link">
          <img src={product.imageUrl} alt={productName} loading="lazy" className="product-card-image" />
        </Link>
        <button className="product-card-wishlist" type="button" aria-label="Add to wishlist">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="product-card-body">
        <div className="product-card-header">
          <p className="product-card-brand">{product.badge}</p>
          <Link to={`/products/${product.id}`} className="product-card-title-link">
            <h3 className="product-card-title">{productName}</h3>
          </Link>
          <div className="product-card-rating">
            <span className="rating-stars" aria-hidden="true">★</span>
            <span className="rating-value">{product.rating.toFixed(1)}</span>
            <span className="rating-count">({formatProductReviews(product.reviewCount, language)})</span>
          </div>
        </div>

        <div className="product-card-pricing">
          <span className="price-current">{formatProductPrice(product.price, language)}</span>
        </div>

        <div className="product-card-actions">
          <button
            type="button"
            className="btn-add-to-cart"
            onClick={() => handleAddToCart(product.id)}
          >
            {copy.common.addToCart}
          </button>
          <button
            type="button"
            className="btn-buy-now"
            onClick={() => handleBuyNow(product.id)}
          >
            {copy.common.buyNow}
          </button>
        </div>
      </div>
    </article>
  );
}
