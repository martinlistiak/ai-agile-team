import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    const requestUrl = String(error.config?.url ?? '');
    const isAuthBootstrapRequest = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/github/callback')
      || requestUrl.includes('/auth/github');

    if (error.response?.status === 401 && !isAuthBootstrapRequest) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
