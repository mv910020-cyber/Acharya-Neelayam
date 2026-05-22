import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCategoryLabel, getProductName } from '../content/siteCopy';
import { useLanguage } from '../context/LanguageContext';
import { useStore } from '../context/StoreContext';

export default function CartDrawer() {
  const { language, copy } = useLanguage();
  const {
    cartEntries,
    cartCount,
    isCartOpen,
    closeCart,
    removeFromCart,
  } = useStore();
  const navigate = useNavigate();

  const handleProceedToCheckout = () => {
    if (cartEntries.length === 0) {
      return;
    }

    navigate('/checkout', {
      state: { cartMode: true },
    });
    closeCart();
  };

  useEffect(() => {
    if (!isCartOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCart();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeCart, isCartOpen]);

  if (!isCartOpen) {
    return null;
  }

  return (
    <div className="cart-drawer-root" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <button
        type="button"
        className="cart-overlay"
        aria-label={copy.cart.close}
        onClick={closeCart}
      />

      <aside className="cart-panel">
        <div className="cart-panel-header">
          <h2 id="cart-title">{copy.cart.title(cartCount)}</h2>
          <button type="button" className="cart-close" onClick={closeCart}>
            {copy.cart.close}
          </button>
        </div>

        {!cartEntries.length ? (
          <div className="cart-empty">
            <h3>{copy.cart.emptyTitle}</h3>
            <p>{copy.cart.emptyCopy}</p>
            <Link to="/products" className="primary-button" onClick={closeCart}>
              {copy.cart.browseProducts}
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cartEntries.map(({ product, quantity }) => {
                const localizedName = getProductName(product.id, product.name, language);
                const secondaryLabel =
                  language === 'te' && localizedName !== product.name
                    ? product.name
                    : getCategoryLabel(product.category, language);

                return (
                  <article key={product.id} className="cart-item">
                    <img
                      src={product.imageUrl}
                      alt={localizedName}
                      className="cart-item-image"
                    />

                    <div className="cart-item-copy">
                      <h3>{localizedName}</h3>
                      <p>{secondaryLabel}</p>
                      <span className="cart-item-qty">{copy.cart.quantity(quantity)}</span>
                    </div>

                    <button
                      type="button"
                      className="cart-remove"
                      onClick={() => removeFromCart(product.id)}
                    >
                      {copy.cart.remove}
                    </button>
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              className="cart-checkout"
              onClick={handleProceedToCheckout}
            >
              {copy.common.buyNow}
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
