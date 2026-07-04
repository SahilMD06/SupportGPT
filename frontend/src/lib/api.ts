import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach JWT
api.interceptors.request.use((config) => {
  const token = Cookies.get('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle expired/invalid sessions
//
// IMPORTANT: We only want to force a redirect-to-login when a 401 comes
// from a PROTECTED route (meaning the user's token expired/is invalid).
// We must NOT force a redirect when the 401 comes from the login or
// register endpoints themselves — that's just "wrong password", and the
// calling component needs to catch it and show a toast, not get wiped
// out by a page reload.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const requestUrl: string = err.config?.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    if (err.response?.status === 401 && !isAuthEndpoint) {
      Cookies.remove('auth_token');
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const chatAPI = {
  send: (data: { message: string; session_id?: string }) =>
    api.post('/chat', data),
  streamUrl: `${API_BASE}/chat/stream`,
};

// ─── History ──────────────────────────────────────────────────────────────────

export const historyAPI = {
  getSessions: () => api.get('/history'),
  getConversation: (sessionId: string) => api.get(`/history/${sessionId}`),
  deleteConversation: (sessionId: string) => api.delete(`/history/${sessionId}`),
};

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export const knowledgeAPI = {
  upload: (formData: FormData) =>
    api.post('/knowledge/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: () => api.get('/knowledge/documents'),
  delete: (id: string) => api.delete(`/knowledge/documents/${id}`),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsAPI = {
  get: () => api.get('/analytics'),
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminAPI = {
  rebuildEmbeddings: () => api.post('/admin/rebuild-embeddings'),
  getStats: () => api.get('/admin/stats'),
  listUsers: () => api.get('/admin/users'),
  listConversations: () => api.get('/admin/conversations'),
  updateUserRole: (userId: string, role: string) =>
    api.patch(`/admin/users/${userId}/role?role=${role}`),
};

export default api;
