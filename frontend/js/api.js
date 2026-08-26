const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getToken() {
  return sessionStorage.getItem('token');
}

function setToken(token) {
  sessionStorage.setItem('token', token);
  localStorage.removeItem('token');
}

function clearToken() {
  sessionStorage.removeItem('token');
  localStorage.removeItem('token');
}

function getRole() {
  return sessionStorage.getItem('role');
}

function setRole(role) {
  sessionStorage.setItem('role', role);
  localStorage.removeItem('role');
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function logout() {
  clearToken();
  sessionStorage.removeItem('role');
  localStorage.removeItem('role');
  window.location.href = '/login';
}

function parseJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isAdmin() {
  const token = getToken();
  if (!token) return false;
  const payload = parseJWT(token);
  return payload && payload.role === 'admin' && payload.exp * 1000 > Date.now();
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function login(secret) {
  const res = await fetch(AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ secret })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
  setToken(data.token);
  setRole(data.role);
  return data;
}

async function apiRead(path) {
  const token = getToken();
  const res = await fetch(LETTERS_FUNCTION_URL + path, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}
