const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function clearToken() {
  localStorage.removeItem('token');
}

function getRole() {
  return localStorage.getItem('role');
}

function setRole(role) {
  localStorage.setItem('role', role);
}

function logout() {
  clearToken();
  localStorage.removeItem('role');
  window.location.href = '/admin/login.html';
}

async function apiPublic(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

async function apiAuth(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/admin/login.html';
    throw new Error('No autenticado');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res.json();
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
