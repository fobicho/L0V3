if (!getToken() || !isAdmin()) {
  window.location.href = '/login';
}

let currentLetters = [];
let pendingImages = [];
let currentPage = 1;
let pageSize = 1;

const MAX_IMAGES = 10;

async function loadPanel() {
  const list = document.getElementById('panel-list');
  try {
    currentLetters = await apiRead('');
    if (pageSize === 1) pageSize = currentLetters.length || 1;
    const oldPagination = document.querySelector('.pagination');
    if (oldPagination) oldPagination.remove();

    if (currentLetters.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <img class="brand-icon empty-state-emoji" src="../icon.png" alt="">
          <h3>No hay cartas aún</h3>
        </div>`;
      const pagination = document.createElement('nav');
      pagination.className = 'pagination';
      pagination.setAttribute('aria-label', 'Paginación de cartas');
      pagination.innerHTML = '<button class="btn btn-secondary btn-small" disabled>Anterior</button><span>Página 1 de 1</span><button class="btn btn-secondary btn-small" disabled>Siguiente</button>';
      list.after(pagination);
      return;
    }
    const totalPages = Math.max(1, Math.ceil(currentLetters.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageLetters = currentLetters.slice(start, start + pageSize);
    list.innerHTML = pageLetters.map(letter => {
      return `
        <div class="panel-card">
          <div class="panel-card-info">
            <div class="panel-card-title">${escapeHTML(letter.title)}</div>
            <div class="panel-card-preview">${escapeHTML(letter.content)}</div>
            <div class="panel-card-date">${escapeHTML(formatDateTime(letter.created_at))}</div>
          </div>
          <div class="panel-card-actions">
            <button class="btn btn-secondary btn-small" onclick="openView('${letter.id}')">Ver</button>
            <button class="btn btn-danger btn-small" onclick="openConfirm('${letter.id}')">Eliminar</button>
          </div>
        </div>`;
    }).join('');
    if (totalPages >= 1) {
      list.insertAdjacentHTML('afterend', `<nav class="pagination" aria-label="Paginación de cartas">
        <button class="btn btn-secondary btn-small" onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
        <span>Página ${currentPage} de ${totalPages}</span>
        <button class="btn btn-secondary btn-small" onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente</button>
      </nav>`);
    }
    const measuredPageSize = calculatePageSize('#panel-list', '.panel-card');
    if (measuredPageSize !== pageSize) {
      pageSize = measuredPageSize;
      loadPanel();
    }
  } catch (err) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-emoji">😢</div>
        <h3>Error</h3>
        <p>${escapeHTML(err.message || err)}</p>
      </div>`;
  }
}

function changePage(direction) {
  const totalPages = Math.max(1, Math.ceil(currentLetters.length / pageSize));
  const nextPage = currentPage + direction;
  if (nextPage < 1 || nextPage > totalPages) return;
  currentPage = nextPage;
  loadPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openModal() {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('letter-form');

  form.reset();
  document.getElementById('edit-id').value = '';
  pendingImages = [];
  renderImagePreview();
  title.textContent = 'Nueva Carta';

  overlay.classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

async function apiUpload(file) {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(LETTERS_FUNCTION_URL + '/upload', {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token
    },
    body: fd
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al subir la imagen');
  return data;
}

async function apiDeleteImage(url) {
  const token = getToken();
  try {
    await fetch(LETTERS_FUNCTION_URL + '/upload?url=' + encodeURIComponent(url), {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + token
      }
    });
  } catch (_) {}
}

function renderImagePreview() {
  const preview = document.getElementById('image-preview');
  const count = document.getElementById('image-count');
  preview.innerHTML = pendingImages.map((img, i) => {
    const busy = img.uploading ? ' uploading' : '';
    const media = img.url
      ? `<img src="${escapeHTML(img.url)}" alt="">`
      : '<div class="image-preview-placeholder"></div>';
    return `
      <div class="image-preview-item${busy}">
        ${media}
        <button type="button" class="image-preview-remove" data-index="${i}" aria-label="Quitar imagen">×</button>
        ${img.uploading ? '<div class="image-preview-spinner"></div>' : ''}
      </div>`;
  }).join('');
  count.textContent = pendingImages.length + ' / ' + MAX_IMAGES;

  preview.querySelectorAll('.image-preview-remove').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const removed = pendingImages.splice(idx, 1)[0];
      if (removed && !removed.uploading) apiDeleteImage(removed.path);
      renderImagePreview();
    });
  });
}

function setupImageInput() {
  const input = document.getElementById('input-images');
  input.addEventListener('change', async function () {
    const files = Array.from(input.files || []);
    for (const file of files) {
      if (pendingImages.length >= MAX_IMAGES) {
        alert('Máximo ' + MAX_IMAGES + ' imágenes por carta');
        break;
      }
      const entry = { url: '', uploading: true };
      pendingImages.push(entry);
      renderImagePreview();
      try {
        const uploaded = await apiUpload(file);
        entry.path = uploaded.path;
        entry.url = uploaded.url;
        entry.uploading = false;
      } catch (err) {
        pendingImages.pop();
        alert(err.message);
      }
      renderImagePreview();
    }
    input.value = '';
  });
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
  const preview = document.getElementById('view-preview');
  preview.innerHTML = renderLetter(letter, false);
  document.getElementById('view-overlay').classList.add('show');
  const overlay = document.getElementById('view-overlay');
  overlay.scrollTop = 0;
  overlay.querySelectorAll('.modal-content, .modal-body').forEach((element) => {
    element.scrollTop = 0;
  });
}

function closeView() {
  document.getElementById('view-overlay').classList.remove('show');
}

document.getElementById('letter-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    title: document.getElementById('input-title').value,
    content: document.getElementById('input-content').value,
    images: pendingImages.filter((i) => !i.uploading).map((i) => i.path)
  };

  try {
    await apiWrite('', 'POST', body);
    pendingImages = [];
    closeModal();
    loadPanel();
  } catch (err) {
    alert(err.message);
  }
});

function cancelModal() {
  pendingImages
    .filter((i) => !i.uploading && i.url)
    .forEach((i) => apiDeleteImage(i.path));
  pendingImages = [];
  closeModal();
}

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

async function confirmDeleteAll() {
  if (!currentLetters.length) return;
  if (!confirm('¿Seguro que quieres eliminar todas las cartas? Esta acción no se puede deshacer.')) return;
  try {
    const lettersToDelete = [...currentLetters];
    const results = await Promise.allSettled(
      lettersToDelete.map(letter => apiWrite('/' + letter.id, 'DELETE'))
    );
    const failed = results.filter(result => result.status === 'rejected').length;
    if (failed) alert(failed + ' carta(s) no pudieron eliminarse.');
    currentPage = 1;
    window.location.reload();
  } catch (err) {
    alert(err.message);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  setupImageInput();
  document.getElementById('view-overlay').addEventListener('click', function (event) {
    if (event.target === event.currentTarget) closeView();
  });
  window.addEventListener('resize', function () {
    const nextPageSize = calculatePageSize('#panel-list', '.panel-card');
    if (nextPageSize !== pageSize) {
      pageSize = nextPageSize;
      loadPanel();
    }
  });
  loadPanel();
});
