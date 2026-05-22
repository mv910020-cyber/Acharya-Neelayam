/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayPaymentError {
  code?: string;
  description?: string;
  metadata?: {
    order_id?: string;
    payment_id?: string;
  };
  reason?: string;
  source?: string;
  step?: string;
}

interface RazorpayPaymentFailureResponse {
  error: RazorpayPaymentError;
}

interface RazorpayInstance {
  on: (
    eventName: 'payment.failed',
    callback: (response: RazorpayPaymentFailureResponse) => void
  ) => void;
  open: () => void;
}

interface RazorpayOptions {
  amount: number | string;
  config?: {
    display?: {
      language?: string;
    };
  };
  currency: string;
  description?: string;
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
  key: string;
  modal?: {
    ondismiss?: () => void;
  };
  name: string;
  notes?: Record<string, string>;
  order_id: string;
  prefill?: {
    contact?: string;
    email?: string;
    name?: string;
  };
  retry?: {
    enabled: boolean;
  };
  theme?: {
    color?: string;
  };
}

interface Window {
  Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
}
