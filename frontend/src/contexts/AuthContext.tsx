import React, { createContext, useReducer, useCallback, useEffect } from 'react';
import type { User, Company, AuthState } from '../types';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';

export interface AuditResume {
  token: string;
  status: string;
  company_name: string;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ auditResume?: AuditResume } | void>;
  signup: (email: string, password: string, companyName: string, firstName?: string, lastName?: string, planCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setAuthState: (user: User, company: Company) => void;
}

const initialState: AuthState = {
  user: null,
  company: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; company: Company } }
  | { type: 'LOGOUT_SUCCESS' }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_COMPANY'; payload: Company | null };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload };
    case 'LOGIN_SUCCESS':
      return { ...state, user: action.payload.user, company: action.payload.company, isAuthenticated: true, error: null };
    case 'LOGOUT_SUCCESS': return { ...state, user: null, company: null, isAuthenticated: false };
    case 'SET_USER': return { ...state, user: action.payload };
    case 'SET_COMPANY': return { ...state, company: action.payload };
    default: return state;
  }
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface MeResponse {
  user: User;
  company: Company;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore session from secure httpOnly cookie on page load
  useEffect(() => {
    const restoreSession = async () => {
      // Check if user explicitly logged out (logout flag in sessionStorage)
      const loggedOutFlag = sessionStorage.getItem('justLoggedOut');
      if (loggedOutFlag) {
        sessionStorage.removeItem('justLoggedOut');
        dispatch({ type: 'LOGOUT_SUCCESS' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const response = await api.get<MeResponse>(API_ENDPOINTS.auth.me);
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.user, company: response.company } });
      } catch {
        dispatch({ type: 'LOGOUT_SUCCESS' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    void restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    localStorage.removeItem('isDemo');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const response: any = await api.post(API_ENDPOINTS.auth.login, { email, password });
      const { user, company, auditResume } = response;
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, company } });
      return { auditResume };
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Login failed' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const signup = useCallback(async (
    email: string,
    password: string,
    companyName: string,
    firstName?: string,
    lastName?: string,
    planCode?: string,
  ) => {
    localStorage.removeItem('isDemo');
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      // Signup only sends OTP — does NOT create account or set cookies
      // No LOGIN_SUCCESS here — user must verify OTP first
      await api.post(API_ENDPOINTS.auth.signup, {
        email,
        password,
        companyName,
        firstName,
        lastName,
        planCode,
      });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Signup failed' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const logout = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try { await api.post(API_ENDPOINTS.auth.logout); } catch {}
    localStorage.removeItem('isDemo');
    // Prevent re-authentication on next mount
    sessionStorage.setItem('justLoggedOut', 'true');
    dispatch({ type: 'LOGOUT_SUCCESS' });
    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  const refresh = useCallback(async () => {
    try {
      await api.post(API_ENDPOINTS.auth.refresh);
      const response = await api.get<MeResponse>(API_ENDPOINTS.auth.me);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.user, company: response.company } });
    } catch {
      dispatch({ type: 'LOGOUT_SUCCESS' });
    }
  }, []);

  const setUser = useCallback((user: User | null) => {
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const setCompany = useCallback((company: Company | null) => {
    dispatch({ type: 'SET_COMPANY', payload: company });
  }, []);

  const setAuthState = useCallback((user: User, company: Company) => {
    dispatch({ type: 'LOGIN_SUCCESS', payload: { user, company } });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, refresh, setUser, setCompany, setAuthState }}>
      {children}
    </AuthContext.Provider>
  );
};
