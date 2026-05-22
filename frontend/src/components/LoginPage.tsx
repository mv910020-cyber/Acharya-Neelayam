import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 7.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m5 8 7 5 7-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7.5 10V8.2A4.5 4.5 0 0 1 12 3.7a4.5 4.5 0 0 1 4.5 4.5V10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <rect
        x="5.5"
        y="10"
        width="13"
        height="10"
        rx="1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 12s3.6-6 9-6s9 6 9 6s-3.6 6-9 6s-9-6-9-6Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <circle
          cx="12"
          cy="12"
          r="2.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 12s3.6-6 9-6s9 6 9 6s-3.6 6-9 6s-9-6-9-6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 5l14 14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * LoginPage Component
 * Provides user login form with email and password validation.
 * Redirects to home page after successful login.
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  /**
   * Handle form submission.
   * Validates input and calls login function.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate inputs
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    try {
      // Call login function from auth context
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="auth-page login-page login-page-reference">
      <div className="login-reference-stage">
        <h1 className="login-reference-sr-only">Aachara Nilayam Sign In</h1>

        <section className="login-reference-card" aria-label="Sign in form">
          <header className="login-reference-card-header">
            <h2>Sign In</h2>
            <p>Welcome back! Please sign in to continue.</p>
          </header>

          <form className="login-reference-form" onSubmit={handleSubmit}>
            {error ? (
              <div className="login-reference-error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="login-reference-field-group">
              <label htmlFor="email" className="login-reference-label">
                Email Address
              </label>
              <div className="login-reference-input-shell">
                <span className="login-reference-input-icon" aria-hidden="true">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  className="login-reference-input"
                  placeholder="your@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-reference-field-group">
              <label htmlFor="password" className="login-reference-label">
                Password
              </label>
              <div className="login-reference-input-shell">
                <span className="login-reference-input-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-reference-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-reference-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-reference-submit"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? 'Logging in...' : 'LOGIN'}
            </button>
          </form>

          <div className="login-reference-divider" aria-hidden="true">
            <span>OR</span>
          </div>

          <p className="login-reference-signup">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="login-reference-signup-link">
              Sign up here
            </Link>
          </p>
        </section>

        <Link
          to="/products"
          className="login-reference-hitbox login-reference-hitbox-products"
          aria-label="View products"
        >
          View products
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
