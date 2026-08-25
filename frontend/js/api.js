const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  window.location.href = '/acceso';
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
