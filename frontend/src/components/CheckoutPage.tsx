import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getProductName } from '../content/siteCopy';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { type Order, type OrderPaymentOption, useStore } from '../context/StoreContext';
import { formatProductPrice, formatProductReviews } from '../utils/productDisplay';

type CheckoutLocationState = {
  productId?: string;
  cartMode?: boolean;
};

type AddressFormState = {
  addressLineOne: string;
  addressLineTwo: string;
  city: string;
  email: string;
  fullName: string;
  phone: string;
  pincode: string;
  state: string;
};

type PreparedCheckoutData = {
  estimatedDeliveryDate: string;
  fullAddress: string;
  normalizedAddressForm: AddressFormState;
  orderDateTime: string;
  orderTotalAmount: string;
};

type PaymentSuccessState = {
  emailNotificationMessage: string | null;
  emailNotificationSent: boolean;
  orderNumber: string;
  paymentId: string;
  totalAmount: string;
};

type RazorpayOrderResponse = {
  amount: number;
  currency: string;
  description: string;
  keyId: string;
  name: string;
  orderId: string;
  receipt?: string;
  status?: string;
};

type PaymentOption = OrderPaymentOption;
const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let razorpayScriptPromise: Promise<void> | null = null;

function getPaymentMethodLabel(paymentOption: PaymentOption) {
  switch (paymentOption) {
    case 'upi':
      return 'UPI';
    case 'card':
      return 'Card';
    default:
      return 'Cash on Delivery';
  }
}

function getApiErrorMessage(error: unknown) {
  if (
    axios.isAxiosError(error) &&
    typeof error.response?.data?.detail === 'string' &&
    error.response.data.detail.trim()
  ) {
    return error.response.data.detail.trim();
  }

  return null;
}

function loadRazorpayCheckoutScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout can only be loaded in the browser.'));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-razorpay-checkout="true"]'
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Unable to load Razorpay checkout.')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout.'));
    document.body.appendChild(script);
  }).catch((error) => {
    razorpayScriptPromise = null;
    throw error;
  });

  return razorpayScriptPromise;
}

function CheckoutStep({
  active,
  children,
  completed,
  stepNumber,
  summary,
  title,
  onEdit,
}: {
  active: boolean;
  children: ReactNode;
  completed: boolean;
  stepNumber: number;
  summary?: string;
  title: string;
  onEdit?: () => void;
}) {
  return (
    <section
      className={`checkout-step${active ? ' is-active' : ''}${completed ? ' is-complete' : ''}`}
    >
      <div className="checkout-step-header">
        <div className="checkout-step-heading">
          <span className="checkout-step-number">{stepNumber}</span>
          <div>
            <h2>{title}</h2>
            {completed && summary ? <p>{summary}</p> : null}
          </div>
        </div>

        {completed && onEdit ? (
          <button
            type="button"
            className="checkout-step-edit"
            onClick={onEdit}
          >
            Edit
          </button>
        ) : null}
      </div>

      {active ? <div className="checkout-step-body">{children}</div> : null}
    </section>
  );
}

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const checkoutState = location.state as CheckoutLocationState | null;
  const { user } = useAuth();
  const { language, copy } = useLanguage();
  const {
    cartEntries,
    checkoutProduct,
    clearCheckoutProduct,
    createOrder,
    clearCart,
    loading,
    products,
    removeOrder,
    selectCheckoutProduct,
  } = useStore();
  const [activeStep, setActiveStep] = useState(1);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>('upi');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessState | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressFormState>({
    addressLineOne: '',
    addressLineTwo: '',
    city: '',
    email: user?.email ?? '',
    fullName: user?.full_name || user?.username || '',
    phone: '',
    pincode: '',
    state: '',
  });
  const isCartCheckout = checkoutState?.cartMode === true;
  const orderPlaced = paymentSuccess !== null;

  const checkoutCopy =
    language === 'te'
      ? {
          backToProducts: 'ఉత్పత్తులకు తిరిగి వెళ్లండి',
          city: 'నగరం',
          cod: 'క్యాష్ ఆన్ డెలివరీ',
          continueLabel: 'కొనసాగించండి',
          deliveryAddress: 'డెలివరీ చిరునామా',
          email: 'ఈమెయిల్',
          empty: 'దయచేసి ఒక ఉత్పత్తిపై Buy Now నొక్కి checkout ప్రారంభించండి.',
          fullName: 'పూర్తి పేరు',
          lead: 'Flipkart-style step-by-step checkout flow లో మీ ఆర్డర్‌ను పూర్తి చేయండి.',
          loggedInAs: 'లాగిన్ అయిన ఖాతా',
          login: 'లాగిన్ / ఈమెయిల్',
          orderPlaced: 'ఆర్డర్ డెమోగా నమోదు అయింది.',
          orderPlacedCopy:
            'ఇది mock checkout మాత్రమే. ఎంపిక చేసిన item మరియు payment method విజయవంతంగా capture అయ్యాయి.',
          orderSummary: 'ఆర్డర్ సమరీ',
          paymentOptions: 'పేమెంట్ ఆప్షన్స్',
          phone: 'ఫోన్ నంబర్',
          pincode: 'పిన్ కోడ్',
          placeOrder: 'ఆర్డర్ చేయండి',
          price: 'ధర',
          reviews: 'రివ్యూలు',
          selectPayment: 'ఒక payment method ఎంచుకోండి.',
          state: 'రాష్ట్రం',
          stepLocked: 'ఈ దశకు ముందు డెలివరీ చిరునామా పూర్తి చేయండి.',
          title: 'మీ కొనుగోలును పూర్తి చేయండి',
          upi: 'UPI',
          addressLineOne: 'చిరునామా లైన్ 1',
          addressLineTwo: 'చిరునామా లైన్ 2',
          card: 'కార్డ్',
        }
      : {
          backToProducts: 'Back to products',
          city: 'City',
          cod: 'Cash on Delivery',
          continueLabel: 'Continue',
          deliveryAddress: 'Delivery Address',
          email: 'Email',
          empty: 'Pick a product and use Buy Now to start checkout.',
          fullName: 'Full Name',
          lead: 'Complete your order in a Flipkart-style step-by-step checkout flow.',
          loggedInAs: 'Logged in account',
          login: 'Login / Email',
          orderPlaced: 'Order captured as a demo.',
          orderPlacedCopy:
            'This is a mock checkout flow. Your selected item and payment option were saved locally for now.',
          orderSummary: 'Order Summary',
          paymentOptions: 'Payment Options',
          phone: 'Phone Number',
          pincode: 'Pincode',
          placeOrder: 'Place Order',
          price: 'Price',
          reviews: 'Reviews',
          selectPayment: 'Choose one payment method.',
          state: 'State',
          stepLocked: 'Complete the delivery address before moving ahead.',
          title: 'Complete your purchase',
          upi: 'UPI',
          addressLineOne: 'Address Line 1',
          addressLineTwo: 'Address Line 2',
          card: 'Card',
        };

  useEffect(() => {
    if (!isCartCheckout && checkoutState?.productId) {
      selectCheckoutProduct(checkoutState.productId);
    }
  }, [checkoutState?.productId, isCartCheckout, selectCheckoutProduct]);

  useEffect(() => {
    setAddressForm((current) => ({
      ...current,
      email: current.email || user?.email || '',
      fullName: current.fullName || user?.full_name || user?.username || '',
    }));
  }, [user?.email, user?.full_name, user?.username]);

  const selectedProduct = useMemo(() => {
    if (isCartCheckout) {
      return null;
    }

    if (checkoutProduct) {
      return checkoutProduct;
    }

    if (!checkoutState?.productId) {
      return null;
    }

    return products.find((product) => product.id === checkoutState.productId) ?? null;
  }, [checkoutProduct, checkoutState?.productId, products]);

  const checkoutEntries = useMemo(() => {
    if (isCartCheckout) {
      return cartEntries;
    }

    if (!selectedProduct) {
      return [];
    }

    return [{ product: selectedProduct, quantity: 1 }];
  }, [cartEntries, isCartCheckout, selectedProduct]);

  const checkoutTotal = checkoutEntries.reduce(
    (total, entry) => total + entry.product.price * entry.quantity,
    0
  );

  const primaryCheckoutProduct = checkoutEntries[0]?.product ?? selectedProduct;
  const localizedProductName = primaryCheckoutProduct
    ? getProductName(primaryCheckoutProduct.id, primaryCheckoutProduct.name, language)
    : '';

  const loginSummary = user?.email || user?.username || 'Demo account';
  const addressSummary = [
    addressForm.fullName,
    addressForm.addressLineOne,
    addressForm.city,
    addressForm.state,
    addressForm.pincode,
  ]
    .filter(Boolean)
    .join(', ');
  const orderSummary = checkoutEntries.length
    ? isCartCheckout
      ? `${checkoutEntries.length} item${checkoutEntries.length === 1 ? '' : 's'} • ${formatProductPrice(checkoutTotal, language)}`
      : `${localizedProductName} • ${formatProductPrice(primaryCheckoutProduct?.price ?? 0, language)}`
    : '';
  const paymentSummary =
    paymentOption === 'upi'
      ? checkoutCopy.upi
      : paymentOption === 'card'
        ? checkoutCopy.card
        : checkoutCopy.cod;

  const handleAddressSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCustomerEmail = addressForm.email.trim().toLowerCase();

    const requiredValues = [
      addressForm.fullName,
      normalizedCustomerEmail,
      addressForm.phone,
      addressForm.addressLineOne,
      addressForm.city,
      addressForm.state,
      addressForm.pincode,
    ];

    if (requiredValues.some((value) => !value.trim())) {
      setStepError(checkoutCopy.stepLocked);
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedCustomerEmail)) {
      setStepError(
        language === 'te'
          ? 'Order confirmation email pondadaniki valid email address ivvandi.'
          : 'Enter a valid email address to receive your order confirmation.'
      );
      return;
    }

    setStepError(null);
    setActiveStep(3);
  };

  const handlePlaceOrderLegacy = async () => {
    if (!paymentOption || !checkoutEntries.length) {
      setStepError(checkoutCopy.selectPayment);
      return;
    }

    const normalizedAddressForm = {
      addressLineOne: addressForm.addressLineOne.trim(),
      addressLineTwo: addressForm.addressLineTwo.trim(),
      city: addressForm.city.trim(),
      email: addressForm.email.trim().toLowerCase(),
      fullName: addressForm.fullName.trim(),
      phone: addressForm.phone.trim(),
      pincode: addressForm.pincode.trim(),
      state: addressForm.state.trim(),
    };

    const requiredValues = [
      normalizedAddressForm.fullName,
      normalizedAddressForm.email,
      normalizedAddressForm.phone,
      normalizedAddressForm.addressLineOne,
      normalizedAddressForm.city,
      normalizedAddressForm.state,
      normalizedAddressForm.pincode,
    ];

    if (requiredValues.some((value) => !value.trim())) {
      setStepError(checkoutCopy.stepLocked);
      setActiveStep(2);
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedAddressForm.email)) {
      setStepError(
        language === 'te'
          ? 'Order confirmation email pondadaniki valid email address ivvandi.'
          : 'Enter a valid email address to receive your order confirmation.'
      );
      setActiveStep(2);
      return;
    }

    const fullAddress = [
      normalizedAddressForm.addressLineOne,
      normalizedAddressForm.addressLineTwo,
      normalizedAddressForm.city,
      normalizedAddressForm.state,
      normalizedAddressForm.pincode,
    ]
      .filter((value) => value.trim())
      .join(', ');

    const orderDateTime = new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());
    const estimatedDeliveryDate = new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
    }).format(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
    const orderTotalAmount = formatProductPrice(checkoutTotal, language);

    const createdOrders: Order[] = [];
    const orderMessageLines = [
      'Order Confirmed',
      `Customer Name: ${normalizedAddressForm.fullName}`,
      `Phone Number: ${normalizedAddressForm.phone}`,
      `Email: ${normalizedAddressForm.email}`,
      `Full Delivery Address: ${fullAddress}`,
      `Payment Method: ${getPaymentMethodLabel(paymentOption)}`,
      `Order Date and Time: ${orderDateTime}`,
      `Estimated Delivery Date: ${estimatedDeliveryDate}`,
      '',
    ];

    checkoutEntries.forEach((entry, index) => {
      const localizedEntryName = getProductName(entry.product.id, entry.product.name, language);
      const createdOrder = createOrder({
        paymentOption,
        product: entry.product,
        shippingAddress: normalizedAddressForm,
      });

      createdOrders.push(createdOrder);
      orderMessageLines.push(
        `Item ${index + 1}: ${localizedEntryName}`,
        `Price: ${formatProductPrice(entry.product.price * entry.quantity, language)}`,
        `Quantity: ${entry.quantity}`,
        `Order Number: ${createdOrder.orderNumber}`,
        ''
      );
    });

    const primaryOrderNumber = createdOrders[0]?.orderNumber ?? '';

    if (primaryOrderNumber) {
      orderMessageLines.push(`Primary Order Number: ${primaryOrderNumber}`);
    }

    orderMessageLines.push(`Total Amount: ${orderTotalAmount}`);

    try {
      await axios.post(`${apiUrl}/orders/send-order-email`, {
        customerEmail: normalizedAddressForm.email,
        customerName: normalizedAddressForm.fullName,
        customerPhone: normalizedAddressForm.phone,
        deliveryAddress: fullAddress,
        estimatedDeliveryDate,
        items: checkoutEntries.map((entry, index) => ({
          imageUrl: entry.product.imageUrl,
          lineTotal: formatProductPrice(entry.product.price * entry.quantity, language),
          name: getProductName(entry.product.id, entry.product.name, language),
          orderNumber: createdOrders[index]?.orderNumber ?? primaryOrderNumber,
          quantity: entry.quantity,
          unitPrice: formatProductPrice(entry.product.price, language),
        })),
        message: orderMessageLines.join('\n'),
        orderDateTime,
        paymentMethod: getPaymentMethodLabel(paymentOption),
        primaryOrderNumber,
        storeUrl: typeof window === 'undefined' ? undefined : window.location.origin,
        totalAmount: orderTotalAmount,
      });
    } catch (orderEmailError) {
      console.error('Order email notification failed:', orderEmailError);
      createdOrders.forEach((order) => removeOrder(order.id));
      const apiErrorMessage =
        axios.isAxiosError(orderEmailError) &&
        typeof orderEmailError.response?.data?.detail === 'string'
          ? orderEmailError.response.data.detail
          : null;
      if (apiErrorMessage) {
        setStepError(apiErrorMessage);
        setActiveStep(2);
        return;
      }
      setStepError(
        language === 'te'
          ? 'ఆర్డర్ ఇమెయిల్ పంపలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.'
          : 'Order email was not sent. Please try again.'
      );
      return;
    }

    setStepError(null);
    clearCheckoutProduct();
    if (isCartCheckout) {
      clearCart();
    }
    navigate('/orders', {
      state: {
        orderId: createdOrders[0]?.id,
        showConfirmation: true,
      },
    });
  };

  void handlePlaceOrderLegacy;

  const prepareCheckoutData = (): PreparedCheckoutData | null => {
    const normalizedAddressForm = {
      addressLineOne: addressForm.addressLineOne.trim(),
      addressLineTwo: addressForm.addressLineTwo.trim(),
      city: addressForm.city.trim(),
      email: addressForm.email.trim().toLowerCase(),
      fullName: addressForm.fullName.trim(),
      phone: addressForm.phone.trim(),
      pincode: addressForm.pincode.trim(),
      state: addressForm.state.trim(),
    };

    const requiredValues = [
      normalizedAddressForm.fullName,
      normalizedAddressForm.email,
      normalizedAddressForm.phone,
      normalizedAddressForm.addressLineOne,
      normalizedAddressForm.city,
      normalizedAddressForm.state,
      normalizedAddressForm.pincode,
    ];

    if (requiredValues.some((value) => !value.trim())) {
      setStepError(checkoutCopy.stepLocked);
      setActiveStep(2);
      return null;
    }

    if (!EMAIL_PATTERN.test(normalizedAddressForm.email)) {
      setStepError('Enter a valid email address to receive your order confirmation.');
      setActiveStep(2);
      return null;
    }

    const fullAddress = [
      normalizedAddressForm.addressLineOne,
      normalizedAddressForm.addressLineTwo,
      normalizedAddressForm.city,
      normalizedAddressForm.state,
      normalizedAddressForm.pincode,
    ]
      .filter((value) => value.trim())
      .join(', ');

    return {
      estimatedDeliveryDate: new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
      }).format(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
      fullAddress,
      normalizedAddressForm,
      orderDateTime: new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date()),
      orderTotalAmount: formatProductPrice(checkoutTotal, language),
    };
  };

  const submitOrderConfirmation = async ({
    preparedCheckoutData,
    rollbackOnEmailFailure,
    selectedPaymentOption,
    verifiedPayment,
  }: {
    preparedCheckoutData: PreparedCheckoutData;
    rollbackOnEmailFailure: boolean;
    selectedPaymentOption: PaymentOption;
    verifiedPayment?: {
      orderId: string;
      paymentId: string;
    };
  }) => {
    const {
      estimatedDeliveryDate,
      fullAddress,
      normalizedAddressForm,
      orderDateTime,
      orderTotalAmount,
    } = preparedCheckoutData;
    const createdOrders: Order[] = [];
    const orderMessageLines = [
      'Order Confirmed',
      `Customer Name: ${normalizedAddressForm.fullName}`,
      `Phone Number: ${normalizedAddressForm.phone}`,
      `Email: ${normalizedAddressForm.email}`,
      `Full Delivery Address: ${fullAddress}`,
      `Payment Method: ${getPaymentMethodLabel(selectedPaymentOption)}`,
      `Order Date and Time: ${orderDateTime}`,
      `Estimated Delivery Date: ${estimatedDeliveryDate}`,
      '',
    ];

    if (verifiedPayment) {
      orderMessageLines.push(
        `Razorpay Payment ID: ${verifiedPayment.paymentId}`,
        `Razorpay Order ID: ${verifiedPayment.orderId}`,
        ''
      );
    }

    checkoutEntries.forEach((entry, index) => {
      const localizedEntryName = getProductName(entry.product.id, entry.product.name, language);
      const createdOrder = createOrder({
        paymentOption: selectedPaymentOption,
        product: entry.product,
        shippingAddress: normalizedAddressForm,
      });

      createdOrders.push(createdOrder);
      orderMessageLines.push(
        `Item ${index + 1}: ${localizedEntryName}`,
        `Price: ${formatProductPrice(entry.product.price * entry.quantity, language)}`,
        `Quantity: ${entry.quantity}`,
        `Order Number: ${createdOrder.orderNumber}`,
        ''
      );
    });

    const primaryOrderNumber = createdOrders[0]?.orderNumber ?? '';

    if (primaryOrderNumber) {
      orderMessageLines.push(`Primary Order Number: ${primaryOrderNumber}`);
    }

    orderMessageLines.push(`Total Amount: ${orderTotalAmount}`);

    let emailNotificationSent = true;
    let emailNotificationMessage: string | null = null;

    try {
      await axios.post(`${apiUrl}/orders/send-order-email`, {
        customerEmail: normalizedAddressForm.email,
        customerName: normalizedAddressForm.fullName,
        customerPhone: normalizedAddressForm.phone,
        deliveryAddress: fullAddress,
        estimatedDeliveryDate,
        items: checkoutEntries.map((entry, index) => ({
          imageUrl: entry.product.imageUrl,
          lineTotal: formatProductPrice(entry.product.price * entry.quantity, language),
          name: getProductName(entry.product.id, entry.product.name, language),
          orderNumber: createdOrders[index]?.orderNumber ?? primaryOrderNumber,
          quantity: entry.quantity,
          unitPrice: formatProductPrice(entry.product.price, language),
        })),
        message: orderMessageLines.join('\n'),
        orderDateTime,
        paymentMethod: getPaymentMethodLabel(selectedPaymentOption),
        primaryOrderNumber,
        storeUrl: typeof window === 'undefined' ? undefined : window.location.origin,
        totalAmount: orderTotalAmount,
      });
    } catch (orderEmailError) {
      console.error('Order email notification failed:', orderEmailError);
      const apiErrorMessage = getApiErrorMessage(orderEmailError);

      if (rollbackOnEmailFailure) {
        createdOrders.forEach((order) => removeOrder(order.id));
        setStepError(apiErrorMessage || 'Order email was not sent. Please try again.');
        setActiveStep(2);
        return null;
      }

      emailNotificationSent = false;
      emailNotificationMessage =
        apiErrorMessage ||
        'Payment was successful, but the confirmation email could not be sent right now.';
    }

    clearCheckoutProduct();
    if (isCartCheckout) {
      clearCart();
    }

    return {
      createdOrders,
      emailNotificationMessage,
      emailNotificationSent,
      primaryOrderNumber,
      totalAmount: orderTotalAmount,
    };
  };

  const openRazorpayCheckout = async (preparedCheckoutData: PreparedCheckoutData) => {
    const receipt = `an-${Date.now()}`;
    const checkoutDescription = isCartCheckout
      ? `${checkoutEntries.length} item checkout`
      : localizedProductName || 'Aachara Nilayam order';

    await loadRazorpayCheckoutScript();

    if (!window.Razorpay) {
      throw new Error('Razorpay checkout is unavailable.');
    }

    const { data: razorpayOrder } = await axios.post<RazorpayOrderResponse>(
      `${apiUrl}/payments/razorpay/order`,
      {
        amount: Math.round(checkoutTotal * 100),
        currency: 'INR',
        description: checkoutDescription,
        notes: {
          checkout_mode: isCartCheckout ? 'cart' : 'single',
          customer_email: preparedCheckoutData.normalizedAddressForm.email,
          customer_name: preparedCheckoutData.normalizedAddressForm.fullName,
        },
        receipt,
      }
    );

    let paymentHandled = false;
    let paymentFailed = false;

    const razorpay = new window.Razorpay({
      amount: razorpayOrder.amount,
      config: {
        display: {
          language: language === 'te' ? 'tel' : 'en',
        },
      },
      currency: razorpayOrder.currency,
      description: razorpayOrder.description,
      handler: async (response) => {
        paymentHandled = true;

        try {
          await axios.post(`${apiUrl}/payments/razorpay/verify`, {
            orderId: razorpayOrder.orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });

          const orderResult = await submitOrderConfirmation({
            preparedCheckoutData,
            rollbackOnEmailFailure: false,
            selectedPaymentOption: 'upi',
            verifiedPayment: {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
            },
          });

          if (!orderResult) {
            return;
          }

          setPaymentSuccess({
            emailNotificationMessage: orderResult.emailNotificationMessage,
            emailNotificationSent: orderResult.emailNotificationSent,
            orderNumber: orderResult.primaryOrderNumber,
            paymentId: response.razorpay_payment_id,
            totalAmount: orderResult.totalAmount,
          });
          setStepError(null);
        } catch (paymentError) {
          console.error('Razorpay payment verification failed:', paymentError);
          setStepError(
            getApiErrorMessage(paymentError) ||
              'Payment was completed, but we could not verify it yet. Please contact support with your payment ID.'
          );
          setActiveStep(4);
        } finally {
          setIsSubmittingOrder(false);
        }
      },
      key: razorpayOrder.keyId,
      modal: {
        ondismiss: () => {
          if (paymentHandled || paymentFailed) {
            return;
          }

          setIsSubmittingOrder(false);
          setStepError('The Razorpay payment window was closed before the payment completed.');
          setActiveStep(4);
        },
      },
      name: razorpayOrder.name,
      notes: {
        customer_email: preparedCheckoutData.normalizedAddressForm.email,
        receipt: razorpayOrder.receipt || receipt,
      },
      order_id: razorpayOrder.orderId,
      prefill: {
        contact: preparedCheckoutData.normalizedAddressForm.phone,
        email: preparedCheckoutData.normalizedAddressForm.email,
        name: preparedCheckoutData.normalizedAddressForm.fullName,
      },
      retry: {
        enabled: true,
      },
      theme: {
        color: '#7c0a0a',
      },
    });

    razorpay.on('payment.failed', (failureResponse) => {
      paymentFailed = true;
      setIsSubmittingOrder(false);
      setStepError(
        failureResponse.error?.description?.trim() ||
          'Razorpay could not complete the payment. Please try again.'
      );
      setActiveStep(4);
    });

    razorpay.open();
  };

  const handlePlaceOrder = async () => {
    if (!paymentOption || !checkoutEntries.length) {
      setStepError(checkoutCopy.selectPayment);
      return;
    }

    const preparedCheckoutData = prepareCheckoutData();
    if (!preparedCheckoutData) {
      return;
    }

    setIsSubmittingOrder(true);
    setStepError(null);

    if (paymentOption === 'upi') {
      try {
        await openRazorpayCheckout(preparedCheckoutData);
      } catch (paymentInitError) {
        console.error('Razorpay checkout initialization failed:', paymentInitError);
        setIsSubmittingOrder(false);
        setStepError(
          getApiErrorMessage(paymentInitError) ||
            (paymentInitError instanceof Error && paymentInitError.message) ||
            'Unable to start Razorpay payment. Please check your configuration and try again.'
        );
        setActiveStep(4);
      }
      return;
    }

    try {
      const orderResult = await submitOrderConfirmation({
        preparedCheckoutData,
        rollbackOnEmailFailure: true,
        selectedPaymentOption: paymentOption,
      });

      if (!orderResult) {
        return;
      }

      navigate('/orders', {
        state: {
          orderId: orderResult.createdOrders[0]?.id,
          showConfirmation: true,
        },
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (paymentSuccess) {
    return (
      <section className="page-shell checkout-page-shell">
        <div className="checkout-payment-success-view">
          <div className="checkout-payment-success-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="presentation">
              <circle cx="24" cy="24" r="24" />
              <path d="M14 25.5L21 32.5L35 18.5" />
            </svg>
          </div>
          <p className="eyebrow">Razorpay Test Payment</p>
          <h1>Payment Successfully Completed</h1>
          <p className="lead">
            Your payment of {paymentSuccess.totalAmount} was verified successfully. Order{' '}
            {paymentSuccess.orderNumber} has been recorded.
          </p>
          <p className="checkout-payment-success-copy">
            {paymentSuccess.emailNotificationSent
              ? 'Confirmation emails have been sent to the customer and the store owner.'
              : 'Payment is complete, but the confirmation email is still pending.'}
          </p>
          {paymentSuccess.emailNotificationMessage ? (
            <div className="status-panel status-panel-error">
              {paymentSuccess.emailNotificationMessage}
            </div>
          ) : null}
          <div className="checkout-payment-success-meta">
            <span>Razorpay Payment ID</span>
            <strong>{paymentSuccess.paymentId}</strong>
          </div>
          <div className="checkout-payment-success-actions">
            <Link
              to={`/orders?orderNumber=${encodeURIComponent(paymentSuccess.orderNumber)}&showConfirmation=1`}
              className="primary-button"
            >
              View Order
            </Link>
            <Link to="/products" className="secondary-button">
              Continue Shopping
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (loading && !products.length && !checkoutEntries.length) {
    return (
      <section className="page-shell">
        <div className="status-panel">{copy.common.loadingProducts}</div>
      </section>
    );
  }

  if (!checkoutEntries.length) {
    return (
      <section className="page-shell">
        <div className="status-panel">
          {checkoutCopy.empty} <Link to="/products">{checkoutCopy.backToProducts}</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell checkout-page-shell">
      <div className="catalog-intro checkout-intro">
        <p className="eyebrow">Secure checkout</p>
        <h1>{checkoutCopy.title}</h1>
        <p className="lead">{checkoutCopy.lead}</p>
      </div>

      <div className="checkout-layout">
        <div className="checkout-steps">
          <CheckoutStep
            active={activeStep === 1}
            completed={activeStep > 1 || orderPlaced}
            onEdit={() => setActiveStep(1)}
            stepNumber={1}
            summary={loginSummary}
            title={checkoutCopy.login}
          >
            <div className="checkout-login-card">
              <span>{checkoutCopy.loggedInAs}</span>
              <strong>{loginSummary}</strong>
              <button
                type="button"
                className="primary-button checkout-continue-button"
                onClick={() => {
                  setStepError(null);
                  setActiveStep(2);
                }}
              >
                {checkoutCopy.continueLabel}
              </button>
            </div>
          </CheckoutStep>

          <CheckoutStep
            active={activeStep === 2}
            completed={activeStep > 2 || orderPlaced}
            onEdit={() => setActiveStep(2)}
            stepNumber={2}
            summary={addressSummary}
            title={checkoutCopy.deliveryAddress}
          >
            <form className="checkout-address-form" onSubmit={handleAddressSubmit}>
              <label className="form-field">
                <span>{checkoutCopy.fullName}</span>
                <input
                  type="text"
                  value={addressForm.fullName}
                  onChange={(event) =>
                    setAddressForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>{checkoutCopy.email}</span>
                <input
                  autoComplete="email"
                  type="email"
                  value={addressForm.email}
                  onChange={(event) =>
                    setAddressForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>{checkoutCopy.phone}</span>
                <input
                  type="tel"
                  value={addressForm.phone}
                  onChange={(event) =>
                    setAddressForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field checkout-address-form-wide">
                <span>{checkoutCopy.addressLineOne}</span>
                <input
                  type="text"
                  value={addressForm.addressLineOne}
                  onChange={(event) =>
                    setAddressForm((current) => ({
                      ...current,
                      addressLineOne: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field checkout-address-form-wide">
                <span>{checkoutCopy.addressLineTwo}</span>
                <input
                  type="text"
                  value={addressForm.addressLineTwo}
                  onChange={(event) =>
                    setAddressForm((current) => ({
                      ...current,
                      addressLineTwo: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>{checkoutCopy.city}</span>
                <input
                  type="text"
                  value={addressForm.city}
                  onChange={(event) =>
                    setAddressForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>{checkoutCopy.state}</span>
                <input
                  type="text"
                  value={addressForm.state}
                  onChange={(event) =>
                    setAddressForm((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>{checkoutCopy.pincode}</span>
                <input
                  type="text"
                  value={addressForm.pincode}
                  onChange={(event) =>
                    setAddressForm((current) => ({
                      ...current,
                      pincode: event.target.value,
                    }))
                  }
                />
              </label>

              <button type="submit" className="primary-button checkout-continue-button">
                {checkoutCopy.continueLabel}
              </button>
            </form>
          </CheckoutStep>

          <CheckoutStep
            active={activeStep === 3}
            completed={activeStep > 3 || orderPlaced}
            onEdit={() => setActiveStep(3)}
            stepNumber={3}
            summary={orderSummary}
            title={checkoutCopy.orderSummary}
          >
            {isCartCheckout ? (
              <div className="checkout-order-list">
                {checkoutEntries.map(({ product, quantity }) => {
                  const productName = getProductName(product.id, product.name, language);

                  return (
                    <article key={product.id} className="checkout-order-card checkout-order-card-summary">
                      <img src={product.imageUrl} alt={productName} />
                      <div className="checkout-order-copy">
                        <h3>{productName}</h3>
                        <p>{product.badge}</p>
                        <div className="checkout-order-meta">
                          <span>{checkoutCopy.price}</span>
                          <strong>{formatProductPrice(product.price * quantity, language)}</strong>
                        </div>
                        <div className="checkout-order-rating">
                          <span aria-hidden="true">★</span>
                          <span>{product.rating.toFixed(1)}</span>
                          <span>{formatProductReviews(product.reviewCount, language)}</span>
                          <span>{`x${quantity}`}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
                <div className="checkout-order-total">
                  <span>{checkoutCopy.price}</span>
                  <strong>{formatProductPrice(checkoutTotal, language)}</strong>
                </div>
                <button
                  type="button"
                  className="primary-button checkout-continue-button"
                  onClick={() => {
                    setStepError(null);
                    setActiveStep(4);
                  }}
                >
                  {checkoutCopy.continueLabel}
                </button>
              </div>
            ) : (
              <div className="checkout-order-card">
                <img src={primaryCheckoutProduct?.imageUrl ?? ''} alt={localizedProductName} />
                <div className="checkout-order-copy">
                  <h3>{localizedProductName}</h3>
                  <p>{primaryCheckoutProduct?.badge}</p>
                  <div className="checkout-order-meta">
                    <span>{checkoutCopy.price}</span>
                    <strong>
                      {formatProductPrice(primaryCheckoutProduct?.price ?? 0, language)}
                    </strong>
                  </div>
                  <div className="checkout-order-rating">
                    <span aria-hidden="true">★</span>
                    <span>{primaryCheckoutProduct?.rating.toFixed(1)}</span>
                    <span>
                      {formatProductReviews(primaryCheckoutProduct?.reviewCount ?? 0, language)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="primary-button checkout-continue-button"
                  onClick={() => {
                    setStepError(null);
                    setActiveStep(4);
                  }}
                >
                  {checkoutCopy.continueLabel}
                </button>
              </div>
            )}
          </CheckoutStep>

          <CheckoutStep
            active={activeStep === 4 || orderPlaced}
            completed={orderPlaced}
            onEdit={() => setActiveStep(4)}
            stepNumber={4}
            summary={orderPlaced ? paymentSummary : undefined}
            title={checkoutCopy.paymentOptions}
          >
            <div className="checkout-payment-list">
              {[
                { key: 'upi' as const, label: checkoutCopy.upi },
                { key: 'cod' as const, label: checkoutCopy.cod },
              ].map((option) => (
                <label key={option.key} className="checkout-payment-option">
                  <input
                    type="radio"
                    name="payment-option"
                    disabled={isSubmittingOrder}
                    checked={paymentOption === option.key}
                    onChange={() => setPaymentOption(option.key)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              className="primary-button checkout-continue-button"
              disabled={isSubmittingOrder}
              onClick={handlePlaceOrder}
            >
              {isSubmittingOrder
                ? paymentOption === 'upi'
                  ? 'Opening Razorpay...'
                  : 'Placing Order...'
                : checkoutCopy.placeOrder}
            </button>

            {orderPlaced ? (
              <div className="status-panel checkout-success-panel">
                <strong>{checkoutCopy.orderPlaced}</strong>
                <p>{checkoutCopy.orderPlacedCopy}</p>
              </div>
            ) : null}
          </CheckoutStep>

          {stepError ? (
            <div className="status-panel status-panel-error">{stepError}</div>
          ) : null}
        </div>

        <aside className="checkout-sidebar">
          <div className="checkout-sidebar-card">
            <img src={primaryCheckoutProduct?.imageUrl ?? ''} alt={localizedProductName} />
            <div className="checkout-sidebar-copy">
              {isCartCheckout ? (
                <>
                  <p className="eyebrow">Cart summary</p>
                  <h2>{checkoutEntries.length} items</h2>
                  <div className="checkout-summary-list">
                    {checkoutEntries.map(({ product, quantity }) => {
                      const productName = getProductName(product.id, product.name, language);

                      return (
                        <div key={product.id} className="checkout-summary-item">
                          <div className="checkout-summary-item-copy">
                            <strong>{productName}</strong>
                            <span>{`x${quantity}`}</span>
                          </div>
                          <strong>{formatProductPrice(product.price * quantity, language)}</strong>
                        </div>
                      );
                    })}
                  </div>
                  <strong>{formatProductPrice(checkoutTotal, language)}</strong>
                </>
              ) : (
                <>
                  <p className="eyebrow">{primaryCheckoutProduct?.category}</p>
                  <h2>{localizedProductName}</h2>
                  <p>{primaryCheckoutProduct?.description}</p>
                  <strong>
                    {formatProductPrice(primaryCheckoutProduct?.price ?? 0, language)}
                  </strong>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
