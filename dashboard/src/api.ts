export { API_BASE_URL, publicAxios, privateAxios, adminAxios } from './utils/axios';

export const clearSession = async () => {
  try {
    await fetch(`${API_BASE_URL}/tenants/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Logout endpoint may be unreachable — cookie will expire on its own
  }
};

export const clearAdminSession = async () => {
  try {
    await fetch(`${API_BASE_URL}/admin/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Logout endpoint may be unreachable — cookie will expire on its own
  }
};

export const redirectToLogin = async () => {
  await clearSession();
  window.location.href = '/dashboard/login';
};

export const redirectToAdminLogin = async () => {
  await clearAdminSession();
  window.location.href = '/dashboard/admin/login';
};

// Legacy support helper (will be phased out as we replace fetch with axios)
export const apiUrl = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
};

export const handleUnauthorized = async (response: any) => {
  if (response.status === 401 || response.status === 403) {
    await redirectToLogin();
    return true;
  }
  return false;
};
