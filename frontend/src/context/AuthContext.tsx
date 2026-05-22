import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

/**
 * Authentication Service
 * Handles API calls for authentication operations (login, register, logout).
 * Uses axios for HTTP requests to the backend API.
 */

interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyToken: () => Promise<boolean>;
}

/**
 * Create authentication context for global state management.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/**
 * Create API client instance with proper configuration.
 * Includes interceptor for adding auth token to requests.
 */
const createApiClient = (token: string | null): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add token to all requests if available
  if (token) {
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  return client;
};

/**
 * AuthProvider component
 * Provides authentication context to all child components.
 * Manages user state, tokens, and authentication operations.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore authentication state from localStorage on component mount
  useEffect(() => {
    const restoreAuthState = async () => {
      try {
        const storedToken = localStorage.getItem('accessToken');
        if (storedToken) {
          // Verify token is still valid
          const apiClient = createApiClient(storedToken);
          const response = await apiClient.get('/auth/me');
          
          setAccessToken(storedToken);
          setUser(response.data);
        }
      } catch (error) {
        // Token is invalid or expired
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuthState();
  }, []);

  /**
   * Login user with email and password.
   * Stores tokens in localStorage for persistence across page reloads.
   */
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const apiClient = createApiClient(null);
      
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });

      const { access_token, refresh_token, user: userData } = response.data;
      
      // Store tokens in localStorage
      localStorage.setItem('accessToken', access_token);
      if (refresh_token) {
        localStorage.setItem('refreshToken', refresh_token);
      }

      // Update state
      setAccessToken(access_token);
      setUser(userData);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login failed';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register new user account.
   * Automatically logs in user after successful registration.
   */
  const register = async (
    email: string,
    username: string,
    password: string,
    fullName?: string
  ) => {
    try {
      setIsLoading(true);
      const apiClient = createApiClient(null);
      
      const response = await apiClient.post('/auth/register', {
        email,
        username,
        password,
        full_name: fullName,
      });

      const { access_token, refresh_token, user: userData } = response.data;
      
      // Store tokens in localStorage
      localStorage.setItem('accessToken', access_token);
      if (refresh_token) {
        localStorage.setItem('refreshToken', refresh_token);
      }

      // Update state
      setAccessToken(access_token);
      setUser(userData);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Registration failed';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout user by clearing tokens and state.
   * Calls backend logout endpoint for server-side cleanup.
   */
  const logout = async () => {
    try {
      if (accessToken) {
        const apiClient = createApiClient(accessToken);
        try {
          await apiClient.post('/auth/logout');
        } catch (error) {
          // Continue logout even if API call fails
          console.error('Logout API call failed:', error);
        }
      }
    } finally {
      // Clear tokens and state regardless of API result
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAccessToken(null);
      setUser(null);
    }
  };

  /**
   * Verify that current token is still valid.
   * Used for checking authentication status.
   */
  const verifyToken = async (): Promise<boolean> => {
    if (!accessToken) return false;

    try {
      const apiClient = createApiClient(accessToken);
      const response = await apiClient.post('/auth/verify-token', {
        token: accessToken,
      });
      return response.data.valid;
    } catch (error) {
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    register,
    logout,
    verifyToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use authentication context.
 * Must be called within AuthProvider component tree.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

/**
 * Create authenticated API client instance.
 * Used throughout the app for making authenticated requests.
 */
export const getAuthenticatedClient = (token: string | null): AxiosInstance => {
  return createApiClient(token);
};
