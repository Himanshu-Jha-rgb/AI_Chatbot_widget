import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Public instance for calls that don't need auth (like Login)
export const publicAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Private instance for normal tenant endpoints
export const privateAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject token on every request
privateAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle unauthorized/forbidden responses globally
privateAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        // Avoid infinite redirect loops if we are already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/dashboard/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Admin instance for sys admin endpoints
export const adminAxios = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

adminAxios.interceptors.request.use(
  (config) => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken && config.headers) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

adminAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      if (status === 401 || status === 403) {
        localStorage.removeItem('adminToken');
        if (!window.location.pathname.includes('/admin/login')) {
          window.location.href = '/dashboard/admin/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
