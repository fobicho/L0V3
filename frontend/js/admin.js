if (!getToken() || getRole() !== 'admin') {
  window.location.href = 'login.html';
}

let currentLetters = [];

async function loadPanel() {
  const list = document.getElementById('panel-list');
  try {
    currentLetters = await apiAuth('/letters');
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
            <div class="panel-card-title">${letter.title}</div>
            <div class="panel-card-preview">${letter.content}</div>
            <div class="panel-card-date">${formatDate(letter.createdAt)}</div>
          </div>
          <div class="panel-card-actions">
            <button class="btn btn-secondary btn-small" onclick="openModal('${letter.id}')">✏️ Editar</button>
            <button class="btn btn-danger btn-small" onclick="openConfirm('${letter.id}')">🗑️</button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">😢</div>
        <h3>Error</h3>
        <p>${err.message}</p>
      </div>`;
  }
}

function openModal(id = null) {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('letter-form');

  form.reset();
  document.getElementById('edit-id').value = '';

  if (id) {
    const letter = currentLetters.find(l => l.id === id);
    if (!letter) return;
    title.textContent = 'Editar Carta';
    document.getElementById('edit-id').value = id;
    document.getElementById('input-title').value = letter.title;
    document.getElementById('input-content').value = letter.content;
  } else {
    title.textContent = 'Nueva Carta';
  }

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

document.getElementById('letter-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const body = {
    title: document.getElementById('input-title').value,
    content: document.getElementById('input-content').value
  };

  try {
    if (id) {
      await apiAuth(`/letters/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiAuth('/letters', { method: 'POST', body: JSON.stringify(body) });
    }
    closeModal();
    loadPanel();
  } catch (err) {
    alert(err.message);
  }
});

async function confirmDelete() {
  const id = document.getElementById('delete-id').value;
  try {
    await apiAuth(`/letters/${id}`, { method: 'DELETE' });
    closeConfirm();
    loadPanel();
  } catch (err) {
    alert(err.message);
  }
}

document.addEventListener('DOMContentLoaded', loadPanel);
