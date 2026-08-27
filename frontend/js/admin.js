if (!getToken() || !isAdmin()) {
  window.location.href = '/login';
}

let currentLetters = [];
let pendingImages = [];

const MAX_IMAGES = 10;

async function loadPanel() {
  const list = document.getElementById('panel-list');
  try {
    currentLetters = await apiRead('');

    if (currentLetters.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <img class="brand-icon empty-state-emoji" src="../icon.png" alt="">
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
            <button class="btn btn-secondary btn-small" onclick="openView('${letter.id}')">Ver</button>
            <button class="btn btn-danger btn-small" onclick="openConfirm('${letter.id}')">Eliminar</button>
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
  return data.url;
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
  } catch (_) { /* ignore */ }
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
      if (removed && !removed.uploading) apiDeleteImage(removed.url);
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
        const url = await apiUpload(file);
        entry.url = url;
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
  document.getElementById('view-title').textContent = letter.title;
  document.getElementById('view-content').textContent = letter.content;
  const gallery = document.getElementById('view-gallery');
  if (gallery) {
    gallery.innerHTML = (letter.images && letter.images.length)
      ? '<div class="letter-gallery">' + letter.images.map(src =>
          '<img class="gallery-img" src="' + escapeHTML(src) + '" alt="">').join('') + '</div>'
      : '';
  }
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
    content: document.getElementById('input-content').value,
    images: pendingImages.filter((i) => !i.uploading).map((i) => i.url)
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
    .forEach((i) => apiDeleteImage(i.url));
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

document.addEventListener('DOMContentLoaded', function () {
  setupImageInput();
  loadPanel();
});
