export { API_BASE_URL, publicAxios, privateAxios, adminAxios } from './utils/axios';

export const clearSession = () => {
  localStorage.removeItem('token');
};

export const redirectToLogin = () => {
  clearSession();
  window.location.href = '/dashboard/login';
};

// Legacy support helper (will be phased out as we replace fetch with axios)
export const apiUrl = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
};

export const handleUnauthorized = (response: any) => {
  if (response.status === 401 || response.status === 403) {
    redirectToLogin();
    return true;
  }
  return false;
};
