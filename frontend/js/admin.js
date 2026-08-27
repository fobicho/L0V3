if (!getToken() || !isAdmin()) {
  window.location.href = '/login';
}

let currentLetters = [];

async function loadPanel() {
  const list = document.getElementById('panel-list');
  try {
    currentLetters = await apiRead('');

    if (currentLetters.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-emoji">💌</div>
          <h3>No hay cartas aún</h3>
          <p>Crea la primera carta para tu novia</p>
        </div>`;
      return;
    }
    list.innerHTML = currentLetters.map(letter => {
      return `
        <div class="panel-card">
          <div class="panel-card-info">
            <div class="panel-card-title">${escapeHTML(letter.title)}</div>
            <div class="panel-card-preview">${escapeHTML(letter.content)}</div>
            <div class="panel-card-date">${escapeHTML(formatDate(letter.created_at))}</div>
          </div>
          <div class="panel-card-actions">
            <button class="btn btn-secondary btn-small" onclick="openView('${letter.id}')">👁️ Ver</button>
            <button class="btn btn-danger btn-small" onclick="openConfirm('${letter.id}')">🗑️</button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">😢</div>
        <h3>Error</h3>
        <p>${escapeHTML(err.message || err)}</p>
      </div>`;
  }
}

function openModal() {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('letter-form');

  form.reset();
  document.getElementById('edit-id').value = '';
  title.textContent = 'Nueva Carta';

  overlay.classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

function openConfirm(id) {
  document.getElementById('delete-id').value = id;
  document.getElementById('confirm-overlay').classList.add('show');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('show');
}

function openView(id) {
  const letter = currentLetters.find(l => l.id === id);
  if (!letter) return;
  document.getElementById('view-title').textContent = letter.title;
  document.getElementById('view-content').textContent = letter.content;
  document.getElementById('view-overlay').classList.add('show');
}

function closeView() {
  document.getElementById('view-overlay').classList.remove('show');
}

async function apiWrite(path, method, body) {
  const token = getToken();
  const res = await fetch(LETTERS_FUNCTION_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

document.getElementById('letter-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    title: document.getElementById('input-title').value,
    content: document.getElementById('input-content').value
  };

  try {
    await apiWrite('', 'POST', body);
    closeModal();
    loadPanel();
  } catch (err) {
    alert(err.message);
  }
});

async function confirmDelete() {
  const id = document.getElementById('delete-id').value;
  try {
    await apiWrite('/' + id, 'DELETE');
    closeConfirm();
    loadPanel();
  } catch (err) {
    alert(err.message);
  }
}

document.addEventListener('DOMContentLoaded', loadPanel);
