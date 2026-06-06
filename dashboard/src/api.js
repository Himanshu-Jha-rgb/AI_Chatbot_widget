export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const apiUrl = (path) => `${API_BASE_URL}${path}`;

export const clearSession = () => {
    localStorage.removeItem('token');
};

export const redirectToLogin = () => {
    clearSession();
    window.location.href = '/dashboard/login';
};

export const handleUnauthorized = (response) => {
    if (response.status === 401 || response.status === 403) {
        redirectToLogin();
        return true;
    }
    return false;
};
