const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function clearToken() {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
}

function getRole() {
  return localStorage.getItem('role');
}

function setRole(role) {
  localStorage.setItem('role', role);
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openImageViewer(src) {
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.className = 'image-viewer-overlay';
  overlay.innerHTML = '<div class="image-viewer" role="dialog" aria-modal="true" aria-label="Imagen ampliada">' +
    '<button type="button" class="image-viewer-close" aria-label="Cerrar">×</button>' +
    '<img src="' + escapeHTML(src) + '" alt="Imagen ampliada">' +
    '<button type="button" class="btn btn-secondary image-download">Descargar foto</button>' +
    '</div>';
  document.body.appendChild(overlay);
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  }
  function onKeyDown(event) {
    if (event.key === 'Escape') close();
  }
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay || event.target.closest('.image-viewer-close')) close();
  });
  overlay.querySelector('.image-download').addEventListener('click', async function() {
    const button = this;
    button.disabled = true;
    button.textContent = 'Preparando descarga…';
    try {
      const response = await fetch(src, { mode: 'cors' });
      if (!response.ok) throw new Error('No se pudo descargar la imagen');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const extension = (blob.type.split('/')[1] || 'jpg').split(';')[0];
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'foto-' + Date.now() + '.' + extension;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function() { URL.revokeObjectURL(objectUrl); }, 1000);
      button.textContent = 'Descarga iniciada';
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Descargar foto';
      window.open(src, '_blank', 'noopener');
    }
  });
  document.addEventListener('keydown', onKeyDown);
}

async function markLetterRead(id) {
  await fetch(LETTERS_FUNCTION_URL + '/' + encodeURIComponent(id) + '/read', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + getToken()
    }
  });
}

document.addEventListener('click', function(event) {
  const image = event.target.closest('.gallery-img');
  if (image) openImageViewer(image.getAttribute('src'));
});

function logout() {
  clearToken();
  localStorage.removeItem('role');
  sessionStorage.removeItem('role');
  window.location.href = '/login';
}

function parseJWT(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)));
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

async function apiWrite(path, method, body) {
  const res = await fetch(LETTERS_FUNCTION_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + getToken()
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}
