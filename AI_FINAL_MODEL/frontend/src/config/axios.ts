import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
axios.defaults.baseURL = API_URL.replace(/\/$/, '');
axios.defaults.withCredentials = true;
axios.defaults.timeout = 30_000; // 30-second timeout on all requests

// Auto-redirect to /login on 401 (session expired, token invalid)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/invite')
    ) {
      const current = window.location.pathname + window.location.search;
      const redirect = current !== '/' ? `?redirect=${encodeURIComponent(current)}` : '';
      window.location.replace(`/login${redirect}`);
    }
    return Promise.reject(error);
  }
);

export default axios;
