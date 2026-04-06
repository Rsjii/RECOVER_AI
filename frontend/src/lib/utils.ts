import type { RiskLevel } from '../types/invoice';
import { RISK_COLORS } from './constants';
import { format, differenceInDays } from 'date-fns';
import { logError } from '../utils/logger';

export const formatCurrency = (value: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
};

export const formatDate = (date: string | Date, formatStr: string = 'MMM dd, yyyy'): string => {
  try {
    return format(new Date(date), formatStr);
  } catch {
    return 'Invalid date';
  }
};

export const getRiskLevel = (score: number): RiskLevel => {
  if (score < 30) return 'low';
  if (score < 60) return 'medium';
  if (score < 90) return 'high';
  return 'critical';
};

export const getRiskColor = (score: number): string => {
  const level = getRiskLevel(score);
  return RISK_COLORS[level];
};

export const calculateDaysOverdue = (dueDate: string): number => {
  const due = new Date(dueDate);
  const today = new Date();
  return Math.max(0, differenceInDays(today, due));
};

export const formatNumber = (value: number): string => value.toLocaleString('en-US');

export const validateEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const validatePassword = (password: string): boolean =>
  password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*]/.test(password);

export const getPasswordStrength = (password: string): { score: number; message: string } => {
  let score = 0;
  const missing: string[] = [];

  if (password.length >= 8) score++; else missing.push('8+ characters');
  if (/[A-Z]/.test(password)) score++; else missing.push('uppercase letter');
  if (/[0-9]/.test(password)) score++; else missing.push('number');
  if (/[!@#$%^&*]/.test(password)) score++; else missing.push('special character');

  return {
    score,
    message: missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'Strong password',
  };
};

export const truncate = (str: string, length = 50): string =>
  str.length > length ? `${str.substring(0, length)}...` : str;

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const storage = {
  setItem: (key: string, value: any) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { logError('Storage', 'setItem', `Failed to set ${key}`, e); }
  },
  getItem: (key: string, defaultValue: any = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch { return defaultValue; }
  },
  removeItem: (key: string) => {
    try { localStorage.removeItem(key); } catch (e) { logError('Storage', 'removeItem', `Failed to remove ${key}`, e); }
  },
  clear: () => {
    try { localStorage.clear(); } catch (e) { logError('Storage', 'clear', 'Failed to clear storage', e); }
  },
};

export const getInitials = (name: string): string =>
  name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);

export const cn = (...classes: (string | undefined | null | false)[]): string =>
  classes.filter(Boolean).join(' ');
