import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export function useProductActions() {
  const navigate = useNavigate();
  const { addToCart, selectCheckoutProduct } = useStore();

  const handleAddToCart = (productId: string) => {
    addToCart(productId);
  };

  const handleBuyNow = (productId: string) => {
    selectCheckoutProduct(productId);
    navigate('/checkout', { state: { productId } });
  };

  return {
    handleAddToCart,
    handleBuyNow,
  };
}
