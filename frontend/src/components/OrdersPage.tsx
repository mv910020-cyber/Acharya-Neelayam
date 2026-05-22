import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getProductName } from '../content/siteCopy';
import { useLanguage } from '../context/LanguageContext';
import {
  type Order,
  type OrderPaymentOption,
  type OrderStatus,
  useStore,
} from '../context/StoreContext';
import { formatProductPrice } from '../utils/productDisplay';

type OrdersLocationState = {
  orderId?: string;
  showConfirmation?: boolean;
};

const TRACKING_FLOW: Array<{
  description: string;
  key: OrderStatus;
  label: string;
}> = [
  {
    key: 'confirmed',
    label: 'Order Confirmed',
    description: 'Your order has been placed successfully.',
  },
  {
    key: 'packed',
    label: 'Packed',
    description: 'Your item is packed and ready for dispatch.',
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    description: 'Your order is on the way to your address.',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    description: 'Your order has reached you successfully.',
  },
];

function getLiveOrderStatus(order: Order): OrderStatus {
  const elapsedMs = Date.now() - new Date(order.createdAt).getTime();

  if (elapsedMs >= 10 * 60 * 1000) {
    return 'delivered';
  }

  if (elapsedMs >= 5 * 60 * 1000) {
    return 'out_for_delivery';
  }

  if (elapsedMs >= 2 * 60 * 1000) {
    return 'packed';
  }

  return order.status;
}

function getPaymentLabel(paymentOption: OrderPaymentOption) {
  switch (paymentOption) {
    case 'upi':
      return 'UPI';
    case 'card':
      return 'Card';
    default:
      return 'Cash on Delivery';
  }
}

function getStatusLabel(status: OrderStatus) {
  switch (status) {
    case 'packed':
      return 'Packed';
    case 'out_for_delivery':
      return 'Out for Delivery';
    case 'delivered':
      return 'Delivered';
    default:
      return 'Confirmed';
  }
}

function formatOrderDate(dateValue: string, language: 'en' | 'te') {
  return new Intl.DateTimeFormat(language === 'te' ? 'te-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateValue));
}

export default function OrdersPage() {
  const location = useLocation();
  const locationState = location.state as OrdersLocationState | null;
  const { language, copy } = useLanguage();
  const { orders, removeOrder } = useStore();
  const requestedOrderNumber = useMemo(() => {
    const rawOrderNumber = new URLSearchParams(location.search).get('orderNumber');
    return rawOrderNumber?.trim() || null;
  }, [location.search]);
  const showConfirmationFromQuery = useMemo(
    () => new URLSearchParams(location.search).get('showConfirmation') === '1',
    [location.search]
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    locationState?.orderId ?? null
  );

  useEffect(() => {
    if (!orders.length) {
      setSelectedOrderId(null);
      return;
    }

    if (locationState?.orderId) {
      setSelectedOrderId(locationState.orderId);
      return;
    }

    if (requestedOrderNumber) {
      const matchingOrder = orders.find(
        (order) => order.orderNumber === requestedOrderNumber
      );
      if (matchingOrder) {
        setSelectedOrderId(matchingOrder.id);
        return;
      }
    }

    if (selectedOrderId && !orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(orders[0].id);
      return;
    }

    if (!selectedOrderId && orders.length) {
      setSelectedOrderId(orders[0].id);
    }
  }, [locationState?.orderId, orders, requestedOrderNumber, selectedOrderId]);

  const handleDeleteOrder = (orderId: string) => {
    const nextOrders = orders.filter((order) => order.id !== orderId);
    removeOrder(orderId);

    if (selectedOrderId === orderId) {
      setSelectedOrderId(nextOrders[0]?.id ?? null);
    }
  };

  const selectedOrder = useMemo(() => {
    if (!orders.length) {
      return null;
    }

    return orders.find((order) => order.id === selectedOrderId) ?? orders[0];
  }, [orders, selectedOrderId]);

  const selectedOrderStatus = selectedOrder
    ? getLiveOrderStatus(selectedOrder)
    : 'confirmed';
  const selectedStatusIndex = TRACKING_FLOW.findIndex(
    (step) => step.key === selectedOrderStatus
  );
  const showConfirmationBanner =
    (
      Boolean(locationState?.showConfirmation) &&
      Boolean(locationState?.orderId) &&
      selectedOrder?.id === locationState?.orderId
    ) ||
    (
      showConfirmationFromQuery &&
      Boolean(requestedOrderNumber) &&
      selectedOrder?.orderNumber === requestedOrderNumber
    );

  if (!orders.length) {
    return (
      <section className="page-shell">
        <div className="status-panel">
          No orders yet. <Link to="/products">{copy.common.viewProducts}</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell orders-page-shell">
      <div className="catalog-intro">
        <p className="eyebrow">Order updates</p>
        <h1>My Orders</h1>
        <p className="lead">
          Track your latest order, review confirmation details, and open any saved
          order from one place.
        </p>
      </div>

      {showConfirmationBanner && selectedOrder ? (
        <article className="order-confirmation-banner">
          <p className="order-confirmation-kicker">Thank you</p>
          <h2>Order Confirmed</h2>
          <p>
            Your order <strong>{selectedOrder.orderNumber}</strong> has been placed
            successfully.
          </p>
          <div className="order-confirmation-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => setSelectedOrderId(selectedOrder.id)}
            >
              Track This Order
            </button>
            <Link to="/products" className="order-confirmation-link">
              Continue Shopping
            </Link>
          </div>
        </article>
      ) : null}

      <div className="orders-layout">
        <div className="orders-main">
          {selectedOrder ? (
            <article className="order-tracking-card">
              <div className="order-panel-header">
                <div>
                  <p className="eyebrow">Order status tracking</p>
                  <h2>{selectedOrder.orderNumber}</h2>
                </div>
                <span
                  className={`order-status-chip order-status-${selectedOrderStatus.replaceAll(
                    '_',
                    '-'
                  )}`}
                >
                  {getStatusLabel(selectedOrderStatus)}
                </span>
              </div>

              <ul className="tracking-step-list">
                {TRACKING_FLOW.map((step, index) => {
                  const stateClass =
                    index < selectedStatusIndex
                      ? 'is-complete'
                      : index === selectedStatusIndex
                        ? 'is-current'
                        : 'is-upcoming';

                  return (
                    <li key={step.key} className={`tracking-step ${stateClass}`}>
                      <span className="tracking-step-marker" aria-hidden="true" />
                      <div className="tracking-step-copy">
                        <h3>{step.label}</h3>
                        <p>{step.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="order-tracking-note">
                Last update: {formatOrderDate(selectedOrder.createdAt, language)}
              </p>
            </article>
          ) : null}

          <section className="orders-history-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">My orders</p>
                <h2>Saved order history</h2>
              </div>
            </div>

            <div className="order-history-grid">
              {orders.map((order) => {
                const orderStatus = getLiveOrderStatus(order);
                const localizedProductName = getProductName(
                  order.product.id,
                  order.product.name,
                  language
                );

                return (
                  <article key={order.id} className="order-history-card">
                    <div className="order-history-card-header">
                      <div>
                        <p className="order-history-number">{order.orderNumber}</p>
                        <h3>{localizedProductName}</h3>
                      </div>
                      <span
                        className={`order-status-chip order-status-${orderStatus.replaceAll(
                          '_',
                          '-'
                        )}`}
                      >
                        {getStatusLabel(orderStatus)}
                      </span>
                    </div>

                    <div className="order-history-meta">
                      <span>{formatProductPrice(order.product.price, language)}</span>
                      <span>{getPaymentLabel(order.paymentOption)}</span>
                      <span>{formatOrderDate(order.createdAt, language)}</span>
                    </div>

                    <div className="order-history-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        Track Order
                      </button>
                      <Link
                        to={`/products/${order.product.id}`}
                        className="order-confirmation-link"
                      >
                        View Product
                      </Link>
                      <button
                        type="button"
                        className="order-history-delete-button"
                        onClick={() => handleDeleteOrder(order.id)}
                        aria-label={`Delete order ${order.orderNumber}`}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        {selectedOrder ? (
          <aside className="orders-sidebar">
            <article className="order-summary-card">
              <img
                src={selectedOrder.product.imageUrl}
                alt={getProductName(
                  selectedOrder.product.id,
                  selectedOrder.product.name,
                  language
                )}
              />
              <div className="order-summary-copy">
                <p className="eyebrow">{selectedOrder.product.category}</p>
                <h2>
                  {getProductName(
                    selectedOrder.product.id,
                    selectedOrder.product.name,
                    language
                  )}
                </h2>
                <strong>
                  {formatProductPrice(selectedOrder.product.price, language)}
                </strong>
              </div>

              <div className="order-summary-detail-list">
                <div className="order-summary-detail-row">
                  <span>Order Number</span>
                  <strong>{selectedOrder.orderNumber}</strong>
                </div>
                <div className="order-summary-detail-row">
                  <span>Payment</span>
                  <strong>{getPaymentLabel(selectedOrder.paymentOption)}</strong>
                </div>
                <div className="order-summary-detail-row">
                  <span>Placed On</span>
                  <strong>{formatOrderDate(selectedOrder.createdAt, language)}</strong>
                </div>
              </div>

              <div className="order-address-card">
                <p className="order-address-title">Delivery Address</p>
                <strong>{selectedOrder.shippingAddress.fullName}</strong>
                <p>
                  {selectedOrder.shippingAddress.addressLineOne}
                  {selectedOrder.shippingAddress.addressLineTwo
                    ? `, ${selectedOrder.shippingAddress.addressLineTwo}`
                    : ''}
                  , {selectedOrder.shippingAddress.city},{' '}
                  {selectedOrder.shippingAddress.state} -{' '}
                  {selectedOrder.shippingAddress.pincode}
                </p>
                <p>
                  {selectedOrder.shippingAddress.phone} |{' '}
                  {selectedOrder.shippingAddress.email}
                </p>
              </div>
            </article>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
