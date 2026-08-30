function renderLetter(letter, includeActions, includeTime = true) {
  const images = Array.isArray(letter.images) && letter.images.length
    ? '<div class="letter-gallery">' + letter.images.map(src => '<img class="gallery-img" src="' + escapeHTML(src) + '" alt="Ampliar foto">').join('') + '</div>' : '';
  const date = includeTime ? formatDateTime(letter.created_at) : formatDate(letter.created_at);
  return '<div class="letter-paper"><div class="letter-header"><h1 class="letter-title">' + escapeHTML(letter.title) + '</h1><div class="letter-divider"></div></div><div class="letter-content">' + escapeHTML(letter.content) + '</div>' + images + '<div class="letter-footer"><div class="letter-divider"></div><span class="letter-date">' + escapeHTML(date) + '</span></div></div>' + (includeActions ? '<div class="modal-actions"><button type="button" class="btn btn-secondary modal-close-btn">Cerrar</button></div>' : '');
}
