import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const showcaseCards = [
  {
    title: 'Premium Brass Collection',
    image: '/products/feature-brass-vessels.jpg',
  },
  {
    title: 'Traditional Puja Samagri',
    image: '/products/puja-thali-set.jpg',
  },
  {
    title: 'Marriage Return Gifts',
    image: '/products/pooja-gift-hamper.jpg',
  },
  {
    title: 'Festival Special Gifts',
    image: '/products/decorative-diya-gift.jpg',
  },
];

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
 * RegisterPage Component
 * Provides user registration form with email, username, password validation.
 * Automatically logs in user after successful registration.
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated, isLoading } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  /**
   * Validate form inputs before submission.
   * Returns error message if validation fails, empty string otherwise.
   */
  const validateForm = (): string => {
    if (!email.trim()) {
      return 'Email is required';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address';
    }

    if (!username.trim()) {
      return 'Username is required';
    }

    if (username.length < 3) {
      return 'Username must be at least 3 characters';
    }

    if (username.length > 100) {
      return 'Username must be at most 100 characters';
    }

    if (!password) {
      return 'Password is required';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }

    return '';
  };

  /**
   * Handle form submission.
   * Validates inputs and calls register function.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await register(email, username, password, fullName || undefined);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="auth-page register-page login-page">
      <div className="login-page-scene">
        <p className="login-invocation">
          {'\u0c13\u0c02 \u0c36\u0c4d\u0c30\u0c40 \u0c17\u0c23\u0c47\u0c36\u0c3e\u0c2f \u0c28\u0c2e\u0c03'}
        </p>

        <div className="login-showcase" aria-hidden="true">
          {showcaseCards.map((card) => (
            <article key={card.title} className="login-showcase-card">
              <img src={card.image} alt="" className="login-showcase-image" />
              <p>{card.title}</p>
            </article>
          ))}
        </div>

        <div className="auth-container login-card-shell register-card-shell">
          <span className="login-card-spark login-card-spark-left" aria-hidden="true" />
          <span className="login-card-spark login-card-spark-right" aria-hidden="true" />

          <div className="auth-header login-auth-header">
            <img
              src="/aachara-nilayam-logo.svg"
              alt="Aachara Nilayam"
              className="auth-logo"
            />
            <h1 className="auth-title">Aachara Nilayam</h1>
            <p className="auth-subtitle">Create Your Account</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="auth-error" role="alert">
                <span className="error-icon">!</span>
                <span className="error-message">{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="your@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="choose a username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setError('');
                }}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="fullName" className="form-label">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                className="form-input"
                placeholder="your full name"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setError('');
                }}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="........"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              <p className="form-helper-text">Minimum 8 characters</p>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="........"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </div>

            <div className="login-inline-link">
              <span>Already have an account?</span>{' '}
              <Link to="/login" className="auth-link">
                Login here
              </Link>
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'CREATE ACCOUNT'}
            </button>
          </form>
        </div>

        <div className="login-page-footer">
          <p className="login-footer-copy">
            All Types of Puja Items, Return Gifts &amp; Brass Collection Available
          </p>

          <div className="login-footer-actions">
            <Link to="/products" className="login-footer-button">
              View Products
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
