import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Dev: empty → requests go through Vite proxy (/api/* → localhost:3000) → same-origin, cookies work
// Prod: VITE_API_BASE_URL is set to production backend URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const instance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
});

// Force fresh responses — prevent 304 caching issues
instance.interceptors.request.use((config) => {
  if (config.method === 'get') {
    config.params = { ...config.params, _t: Date.now() };
  }
  return config;
});

// Auto-refresh token logic
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(undefined);
  });
  failedQueue = [];
};

instance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retrying → try refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const path = originalRequest.url || '';
      // Don't retry refresh/login/signup themselves — but still format the error
      if (path.includes('/auth/refresh') || path.includes('/auth/login') || path.includes('/auth/signup')) {
        const data = error.response?.data as Record<string, any> | undefined;
        return Promise.reject({
          status: error.response?.status || 401,
          message: data?.['error'] || data?.['message'] || 'Invalid email or password',
          details: data?.['details'],
        });
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => instance(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await instance.post('/api/auth/refresh');
        processQueue(null);
        return instance(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr);
        // Only redirect to login if on a protected page (not public pages)
        const publicPages = ['/', '/landing', '/pricing', '/security', '/terms', '/privacy', '/cookie-policy', '/dpa', '/demo', '/unsubscribe', '/login', '/signup', '/forgot-password', '/auth/google/callback', '/stripe/oauth/callback', '/onboard'];
        const currentPath = window.location.pathname;
        if (!publicPages.some(page => currentPath.startsWith(page))) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const data = error.response?.data as Record<string, any> | undefined;
    return Promise.reject({
      status: error.response?.status || 500,
      message: data?.['error'] || data?.['message'] || error.message || 'An error occurred',
      details: data?.['details'],
    });
  }
);

export const api = {
  get: async <T = any>(url: string, config?: any): Promise<T> => {
    const response = await instance.get<T>(url, config);
    return response.data;
  },
  post: async <T = any>(url: string, data?: any, config?: any): Promise<T> => {
    const response = await instance.post<T>(url, data, config);
    return response.data;
  },
  put: async <T = any>(url: string, data?: any, config?: any): Promise<T> => {
    const response = await instance.put<T>(url, data, config);
    return response.data;
  },
  patch: async <T = any>(url: string, data?: any, config?: any): Promise<T> => {
    const response = await instance.patch<T>(url, data, config);
    return response.data;
  },
  delete: async <T = any>(url: string, config?: any): Promise<T> => {
    const response = await instance.delete<T>(url, config);
    return response.data;
  },
};

export default instance;
