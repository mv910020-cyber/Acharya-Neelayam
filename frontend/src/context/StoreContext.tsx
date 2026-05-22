/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import axios from 'axios';

export interface Product {
  id: string;
  name: string;
  category: string;
  categoryKey: string;
  categorySlug: string;
  description: string;
  imageUrl: string;
  featured: boolean;
  badge: string;
  useCase: string;
  tags: string[];
  price: number;
  rating: number;
  reviewCount: number;
  quantity: number;
  sortOrder: number;
  isCollection: boolean;
}

export interface Category {
  label: string;
  key: string;
  slug: string;
  description: string;
  productCount: number;
}

export interface InquiryPayload {
  name: string;
  phone: string;
  message: string;
  productId?: string;
}

export interface CartEntry {
  product: Product;
  quantity: number;
}

export type OrderPaymentOption = 'upi' | 'card' | 'cod';
export type OrderStatus = 'confirmed' | 'packed' | 'out_for_delivery' | 'delivered';

export interface OrderAddress {
  addressLineOne: string;
  addressLineTwo: string;
  city: string;
  email: string;
  fullName: string;
  phone: string;
  pincode: string;
  state: string;
}

export interface Order {
  createdAt: string;
  id: string;
  orderNumber: string;
  paymentOption: OrderPaymentOption;
  product: Product;
  shippingAddress: OrderAddress;
  status: OrderStatus;
}

interface StoreContextType {
  products: Product[];
  categories: Category[];
  selectedProduct: Product | null;
  loading: boolean;
  productLoading: boolean;
  inquirySubmitting: boolean;
  error: string | null;
  cartCount: number;
  cartEntries: CartEntry[];
  orders: Order[];
  isCartOpen: boolean;
  checkoutProduct: Product | null;
  checkoutUrl: string;
  fetchProducts: () => Promise<void>;
  fetchProductById: (productId: string) => Promise<void>;
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  createOrder: (payload: {
    paymentOption: OrderPaymentOption;
    product: Product;
    shippingAddress: OrderAddress;
  }) => Order;
  removeOrder: (orderId: string) => void;
  getOrderById: (orderId: string) => Order | null;
  selectCheckoutProduct: (productId: string) => void;
  clearCheckoutProduct: () => void;
  openCart: () => void;
  closeCart: () => void;
  submitInquiry: (payload: InquiryPayload) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);
const STORAGE_KEY = 'aachara-nilayam-cart';
const CHECKOUT_PRODUCT_STORAGE_KEY = 'aachara-nilayam-checkout-product';
const ORDER_STORAGE_KEY = 'aachara-nilayam-orders';

function createEntityId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildOrderNumber(createdAt: Date) {
  const year = createdAt.getFullYear();
  const month = String(createdAt.getMonth() + 1).padStart(2, '0');
  const day = String(createdAt.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(Math.random() * 9000 + 1000);

  return `AN-${year}${month}${day}-${randomSuffix}`;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutProductId, setCheckoutProductId] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.sessionStorage.getItem(CHECKOUT_PRODUCT_STORAGE_KEY);
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    const savedOrders = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (!savedOrders) {
      return [];
    }

    try {
      return JSON.parse(savedOrders) as Order[];
    } catch {
      window.localStorage.removeItem(ORDER_STORAGE_KEY);
      return [];
    }
  });
  const [cartItems, setCartItems] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') {
      return {};
    }

    const savedCart = window.localStorage.getItem(STORAGE_KEY);
    if (!savedCart) {
      return {};
    }

    try {
      return JSON.parse(savedCart) as Record<string, number>;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return {};
    }
  });

  const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!checkoutProductId) {
      window.sessionStorage.removeItem(CHECKOUT_PRODUCT_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(CHECKOUT_PRODUCT_STORAGE_KEY, checkoutProductId);
  }, [checkoutProductId]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        axios.get<Product[]>(`${apiUrl}/products`),
        axios.get<Category[]>(`${apiUrl}/categories`),
      ]);

      setProducts(productsResponse.data);
      setCategories(categoriesResponse.data);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load products right now.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  const fetchProductById = useCallback(async (productId: string) => {
    setProductLoading(true);
    setError(null);

    try {
      const response = await axios.get<Product>(`${apiUrl}/products/${productId}`);
      setSelectedProduct(response.data);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load this product right now.';
      setError(message);
      setSelectedProduct(null);
    } finally {
      setProductLoading(false);
    }
  }, [apiUrl]);

  const addToCart = (productId: string) => {
    setCartItems((current) => ({
      ...current,
      [productId]: (current[productId] ?? 0) + 1,
    }));
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCartItems((current) => {
      const nextItems = { ...current };
      delete nextItems[productId];
      return nextItems;
    });
  };

  const clearCart = () => {
    setCartItems({});
  };

  const createOrder = useCallback(
    (payload: {
      paymentOption: OrderPaymentOption;
      product: Product;
      shippingAddress: OrderAddress;
    }) => {
      const createdAt = new Date();
      const nextOrder: Order = {
        createdAt: createdAt.toISOString(),
        id: createEntityId(),
        orderNumber: buildOrderNumber(createdAt),
        paymentOption: payload.paymentOption,
        product: {
          ...payload.product,
          tags: [...payload.product.tags],
        },
        shippingAddress: { ...payload.shippingAddress },
        status: 'confirmed',
      };

      setOrders((current) => [nextOrder, ...current]);
      return nextOrder;
    },
    []
  );

  const removeOrder = useCallback((orderId: string) => {
    setOrders((current) => current.filter((order) => order.id !== orderId));
  }, []);

  const getOrderById = useCallback(
    (orderId: string) => orders.find((order) => order.id === orderId) ?? null,
    [orders]
  );

  const selectCheckoutProduct = useCallback((productId: string) => {
    setCheckoutProductId(productId);
  }, []);

  const clearCheckoutProduct = useCallback(() => {
    setCheckoutProductId(null);
  }, []);

  const openCart = () => {
    setIsCartOpen(true);
  };

  const closeCart = () => {
    setIsCartOpen(false);
  };

  const submitInquiry = useCallback(async (payload: InquiryPayload) => {
    setInquirySubmitting(true);
    setError(null);

    try {
      await axios.post(`${apiUrl}/inquiries`, payload);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to send your inquiry right now.';
      setError(message);
      throw requestError;
    } finally {
      setInquirySubmitting(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    // Initial catalog loading is intentionally kicked off from an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProducts();
  }, [fetchProducts]);

  const cartCount = Object.values(cartItems).reduce(
    (total, quantity) => total + quantity,
    0
  );

  const checkoutProduct = checkoutProductId
    ? products.find((product) => product.id === checkoutProductId) ?? null
    : null;

  const cartEntries = Object.entries(cartItems)
    .map(([productId, quantity]) => {
      const product = products.find((item) => item.id === productId);

      if (!product) {
        return null;
      }

      return {
        product,
        quantity,
      };
    })
    .filter((entry): entry is CartEntry => entry !== null);

  const checkoutUrl = '#';

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        selectedProduct,
        loading,
        productLoading,
        inquirySubmitting,
        error,
        cartCount,
        cartEntries,
        orders,
        isCartOpen,
        checkoutProduct,
        checkoutUrl,
        fetchProducts,
        fetchProductById,
        addToCart,
        removeFromCart,
        clearCart,
        createOrder,
        removeOrder,
        getOrderById,
        selectCheckoutProduct,
        clearCheckoutProduct,
        openCart,
        closeCart,
        submitInquiry,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }

  return context;
};
