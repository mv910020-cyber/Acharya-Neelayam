import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  BrowserRouter as Router,
  Link,
  NavLink,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import AboutPage from './components/AboutPage';
import AccountPage from './components/AccountPage';
import AssistantChatCard from './components/AssistantChatCard';
import AuspiciousDaysPage from './components/AuspiciousDaysPage';
import CartDrawer from './components/CartDrawer';
import ContactPage from './components/ContactPage';
import CheckoutPage from './components/CheckoutPage';
import HomePage from './components/HomePage';
import OrdersPage from './components/OrdersPage';
import ProductDetailPage from './components/ProductDetailPage';
import ProductsPage from './components/ProductsPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import { contactProfile, getPhoneDigits } from './content/contactProfile';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { StoreProvider, useStore } from './context/StoreContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';
import './auth-styles.css';

type AssistantPosition = {
  x: number;
  y: number;
};

const ASSISTANT_SIZE = 96;
const ASSISTANT_RIGHT_OFFSET = 26;
const ASSISTANT_BOTTOM_OFFSET = 14;
const ASSISTANT_STORAGE_KEY = 'aachara-mitra-position';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDefaultAssistantPosition(): AssistantPosition {
  if (typeof window === 'undefined') {
    return { x: ASSISTANT_RIGHT_OFFSET, y: ASSISTANT_BOTTOM_OFFSET };
  }

  return {
    x: window.innerWidth - ASSISTANT_SIZE - ASSISTANT_RIGHT_OFFSET,
    y: window.innerHeight - ASSISTANT_SIZE - ASSISTANT_BOTTOM_OFFSET,
  };
}

function clampAssistantPosition(position: AssistantPosition): AssistantPosition {
  if (typeof window === 'undefined') {
    return position;
  }

  return {
    x: clamp(position.x, 12, Math.max(12, window.innerWidth - ASSISTANT_SIZE - 12)),
    y: clamp(position.y, 12, Math.max(12, window.innerHeight - ASSISTANT_SIZE - 12)),
  };
}

function readAssistantPosition() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue);
    if (
      typeof parsedValue?.x === 'number' &&
      typeof parsedValue?.y === 'number'
    ) {
      return clampAssistantPosition(parsedValue);
    }
  } catch (error) {
    console.error('Unable to restore assistant position:', error);
  }

  return null;
}

function persistAssistantPosition(position: AssistantPosition) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(position));
  } catch (error) {
    console.error('Unable to save assistant position:', error);
  }
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { cartCount, openCart, isCartOpen } = useStore();
  const { copy } = useLanguage();
  const { isAuthenticated } = useAuth();

  const navigation = [
    { label: copy.header.nav.home, to: '/', end: true },
    { label: copy.header.nav.products, to: '/products' },
    {
      label: copy.header.nav.auspiciousDays,
      to: '/auspicious-days-2026',
    },
    { label: copy.header.nav.about, to: '/about' },
    { label: copy.header.nav.contact, to: '/contact' },
  ];

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <img
            src="/aachara-nilayam-logo.svg"
            alt={copy.header.brandAlt}
            className="brand-logo"
          />
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {copy.header.menu}
        </button>

        <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`}>
          {navigation.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
              }
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-tools">
          {/* User Authentication Section */}
          {!isAuthenticated && (
            <div className="header-auth-section">
              <>
                {/* Show login/register links when not authenticated */}
                <Link
                  to="/login"
                  className="auth-link"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="auth-link auth-link-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            </div>
          )}

          {/* Cart Button (only visible when authenticated) */}
          {isAuthenticated && (
            <button
              type="button"
              className="cart-link"
              aria-expanded={isCartOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setMenuOpen(false);
                openCart();
              }}
            >
              <span className="cart-link-label">{copy.header.cartLabel}</span>
              <span className="cart-link-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 4h2.4l2.1 10.1a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20.3 7.4H6.1" />
                  <circle cx="9.4" cy="19.1" r="1.3" />
                  <circle cx="17" cy="19.1" r="1.3" />
                </svg>
              </span>
              <span className="cart-count">{cartCount}</span>
            </button>
          )}

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive ? 'settings-link settings-link-active' : 'settings-link'
            }
            aria-label={copy.header.settingsLabel}
            title={copy.header.settingsLabel}
            onClick={() => setMenuOpen(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.6 3.4a1.6 1.6 0 0 1 2.8 0l.7 1.4c.2.4.5.6.9.8l1.6.4c1.1.3 1.5 1.6.8 2.4l-1 1.2c-.2.3-.4.7-.4 1.1s.1.8.4 1.1l1 1.2c.7.9.3 2.2-.8 2.4l-1.6.4c-.4.1-.7.4-.9.8l-.7 1.4a1.6 1.6 0 0 1-2.8 0l-.7-1.4c-.2-.4-.5-.6-.9-.8l-1.6-.4c-1.1-.3-1.5-1.6-.8-2.4l1-1.2c.2-.3.4-.7.4-1.1s-.1-.8-.4-1.1l-1-1.2c-.7-.9-.3-2.2.8-2.4l1.6-.4c.4-.1.7-.4.9-.8l.7-1.4Z" />
              <circle cx="12" cy="12" r="3.1" />
            </svg>
          </NavLink>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  const { copy } = useLanguage();
  const quickLinks = [
    { label: copy.header.nav.home, to: '/' },
    { label: copy.header.nav.products, to: '/products' },
    { label: copy.header.nav.auspiciousDays, to: '/auspicious-days-2026' },
    { label: copy.header.nav.about, to: '/about' },
    { label: copy.header.nav.contact, to: '/contact' },
  ];

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand-block">
          <Link to="/" className="footer-brand">
            <img
              src="/aachara-nilayam-logo.svg"
              alt={copy.header.brandAlt}
              className="footer-brand-logo"
            />
          </Link>
          <p className="footer-brand-copy">{copy.footer.title}</p>
          <p className="footer-brand-body">{copy.footer.body}</p>
        </div>

        <div className="footer-column">
          <h2 className="footer-column-title">Quick Links</h2>
          <div className="footer-link-list">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="footer-column">
          <h2 className="footer-column-title">{copy.header.nav.contact}</h2>
          <div className="footer-contact-list">
            <a href={`tel:${getPhoneDigits(contactProfile.phone)}`} className="footer-contact-item">
              <span className="footer-contact-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M6.7 4.8h2.6l1.4 4.2l-1.8 1.8a13.9 13.9 0 0 0 4.3 4.3l1.8-1.8l4.2 1.4v2.6c0 .8-.6 1.4-1.4 1.4C10.7 18.7 5.3 13.3 5.3 6.2c0-.8.6-1.4 1.4-1.4Z" />
                </svg>
              </span>
              <span>{contactProfile.phone}</span>
            </a>
            <a href={`mailto:${contactProfile.email}`} className="footer-contact-item">
              <span className="footer-contact-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4.5 6.5h15v11h-15z" />
                  <path d="m5.6 7.4l6.4 5.2l6.4-5.2" />
                </svg>
              </span>
              <span>{contactProfile.email}</span>
            </a>
            <div className="footer-contact-item">
              <span className="footer-contact-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 20.1s5.2-5.3 5.2-9.5A5.2 5.2 0 1 0 6.8 10.6c0 4.2 5.2 9.5 5.2 9.5Z" />
                  <circle cx="12" cy="10.4" r="1.8" />
                </svg>
              </span>
              <span>{contactProfile.addressLineOne.en}, {contactProfile.addressLineTwo.en}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>&copy; {new Date().getFullYear()} Aachara Nilayam. All Rights Reserved.</p>
      </div>
    </footer>
  );
}

function FloatingAssistant() {
  const { copy } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<AssistantPosition>(() => {
    const storedPosition = readAssistantPosition();
    return storedPosition ?? getDefaultAssistantPosition();
  });
  const dragStateRef = useRef<{
    moved: boolean;
    offsetX: number;
    offsetY: number;
    pointerId: number;
  } | null>(null);
  const positionRef = useRef(position);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => {
        const nextPosition = clampAssistantPosition(current);
        persistAssistantPosition(nextPosition);
        return nextPosition;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      moved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      pointerId: event.pointerId,
    };
    suppressClickRef.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextPosition = clampAssistantPosition({
      x: event.clientX - dragState.offsetX,
      y: event.clientY - dragState.offsetY,
    });

    if (
      Math.abs(nextPosition.x - positionRef.current.x) > 4 ||
      Math.abs(nextPosition.y - positionRef.current.y) > 4
    ) {
      dragState.moved = true;
      suppressClickRef.current = true;
    }

    setPosition(nextPosition);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsDragging(false);
    const nextPosition = clampAssistantPosition(positionRef.current);
    setPosition(nextPosition);
    persistAssistantPosition(nextPosition);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore release failures when the pointer capture has already been cleared.
    }
  };

  const widgetStyle = useMemo(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const shellWidth = Math.min(
      viewportWidth >= 1180 ? 760 : viewportWidth >= 900 ? 640 : 440,
      viewportWidth - 32
    );
    const shellHeight = Math.min(
      viewportWidth >= 900 ? 600 : 700,
      viewportHeight - 32
    );
    const gap = 18;
    const leftCandidate = position.x - shellWidth - gap;
    const alternateLeft = position.x + ASSISTANT_SIZE + gap;
    const resolvedLeft =
      leftCandidate >= 16
        ? leftCandidate
        : clamp(alternateLeft, 16, viewportWidth - shellWidth - 16);

    return {
      left: clamp(resolvedLeft, 16, viewportWidth - shellWidth - 16),
      maxHeight: shellHeight,
      top: clamp(
        position.y + ASSISTANT_SIZE / 2 - shellHeight / 2,
        16,
        viewportHeight - shellHeight - 16
      ),
      width: shellWidth,
    };
  }, [position]);

  return (
    <>
      {isOpen && widgetStyle ? (
        <div className="assistant-widget-shell" style={widgetStyle}>
          <AssistantChatCard
            className="assistant-chat-card-widget"
            onClose={() => setIsOpen(false)}
          />
        </div>
      ) : null}

      <button
        type="button"
        className={`floating-assistant${isOpen ? ' is-open' : ''}${
          isDragging ? ' is-dragging' : ''
        }`}
        style={{ left: position.x, top: position.y }}
        aria-label={copy.assistant.title}
        aria-expanded={isOpen}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }

          setIsOpen((current) => !current);
        }}
        onPointerCancel={finishDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
      >
        <span className="floating-assistant-visual" aria-hidden="true">
          <img
            className="floating-assistant-image"
            src="/ai-assistant-button.png"
            alt=""
            draggable={false}
          />
        </span>
      </button>
    </>
  );
}

function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login/register pages
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Redirect all other routes to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If authenticated, show main application
  return (
    <div className="site-shell">
      <SiteHeader />
      <CartDrawer />

      <main className="site-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:productId" element={<ProductDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/auspicious-days-2026" element={<AuspiciousDaysPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/settings" element={<AccountPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>

      <FloatingAssistant />
      <SiteFooter />
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <StoreProvider>
        <AuthProvider>
          <Router>
            <AppShell />
          </Router>
        </AuthProvider>
      </StoreProvider>
    </LanguageProvider>
  );
}

export default App;
