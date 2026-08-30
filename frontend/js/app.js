window.openLetterModal = function(id) {
  markLetterRead(id).catch(function() {});
  var badge = document.querySelector('.card[data-letter-id="' + id + '"] .card-badge');
  if (badge) badge.remove();
  var card = document.querySelector('.card[data-letter-id="' + id + '"]');
  if (card) card.classList.remove('card-new');

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal-content">' +
      '<div class="modal-body">' +
        '<div class="loading"><img class="brand-icon loading-heart" src="../icon.png" alt="">\n<p>Cargando carta...</p></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  var keyHandler = function(e) {
    if (e.key === 'Escape') closeModal();
  };
  function closeModal() {
    overlay.remove();
    document.removeEventListener('keydown', keyHandler);
  }

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', keyHandler);

  apiRead('/' + encodeURIComponent(id))
    .then(function(letter) {
      var body = overlay.querySelector('.modal-body');
       body.innerHTML =
         '<div class="letter-paper">' +
           '<div class="letter-header">' +
             '<h1 class="letter-title">' + escapeHTML(letter.title) + '</h1>' +
             '<div class="letter-divider"></div>' +
           '</div>' +
           '<div class="letter-content">' + escapeHTML(letter.content) + '</div>' +
           (letter.images && letter.images.length
             ? '<div class="letter-gallery">' + letter.images.map(function (src) {
                 return '<img class="gallery-img" src="' + escapeHTML(src) + '" alt="Ampliar foto">';
               }).join('') + '</div>'
             : '') +
           '<div class="letter-footer">' +
             '<div class="letter-divider"></div>' +
             '<span class="letter-date">' + formatDateTime(letter.created_at) + '</span>' +
           '</div>' +
         '</div>' +
         '<div class="modal-actions"><button type="button" class="btn btn-secondary modal-close-btn">Cerrar</button></div>';
       body.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    }).catch(function(err) {
      overlay.querySelector('.modal-body').innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-emoji">😢</div>' +
          '<h3>Carta no encontrada</h3>' +
          '<p>' + escapeHTML(err.message || err) + '</p>' +
        '</div>';
    });
};

window.loadLetters = function() {
  var grid = document.getElementById('letters-grid');
  if (!grid) return;
  var pageSize = 1;
  var currentPage = 1;

  function calculatePageSize() {
    var sample = grid.querySelector('.card');
    if (!sample) return 1;
    var styles = window.getComputedStyle(grid);
    var columns = styles.gridTemplateColumns.split(' ').length;
    var gap = parseFloat(styles.rowGap) || parseFloat(styles.gap) || 0;
    var cardHeight = sample.getBoundingClientRect().height;
    var listTop = grid.getBoundingClientRect().top;
    var verticalPadding = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    var paginationSpace = 96;
    var availableHeight = window.innerHeight - listTop - paginationSpace;
    var rows = Math.floor((availableHeight - verticalPadding + gap) / (cardHeight + gap));
    return Math.max(1, columns * Math.max(1, rows));
  }

  function renderPagination(totalPages) {
    var old = document.querySelector('.user-pagination');
    if (old) old.remove();
    var pagination = document.createElement('nav');
    pagination.className = 'pagination user-pagination';
    pagination.setAttribute('aria-label', 'Paginación de cartas');
    pagination.innerHTML = '<button class="btn btn-secondary btn-small" ' + (currentPage === 1 ? 'disabled' : '') + '>Anterior</button>' +
      '<span>Página ' + currentPage + ' de ' + totalPages + '</span>' +
      '<button class="btn btn-secondary btn-small" ' + (currentPage === totalPages ? 'disabled' : '') + '>Siguiente</button>';
    pagination.firstElementChild.onclick = function() { currentPage--; renderPage(); };
    pagination.lastElementChild.onclick = function() { currentPage++; renderPage(); };
    grid.after(pagination);
  }

  var allLetters = [];
  function renderPage() {
    var totalPages = Math.max(1, Math.ceil(allLetters.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    var pageLetters = allLetters.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    grid.classList.toggle('is-empty', allLetters.length === 0);
    grid.innerHTML = pageLetters.map(function(letter) {
      var read = letter.is_read === true;
      return '<div class="card' + (!read ? ' card-new' : '') + '" data-letter-id="' + letter.id + '">' +
        '<img class="brand-icon card-envelope" src="../icon.png" alt="">' +
        (!read ? '<div class="card-badge">¡Nueva!</div>' : '') + '</div>';
    }).join('');
    if (allLetters.length === 0) {
      grid.innerHTML = '<div class="empty-state"><img class="brand-icon empty-state-emoji" src="../icon.png" alt=""><h3>Aún no hay cartas</h3></div>';
    }
    var cards = grid.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function() { window.openLetterModal(this.getAttribute('data-letter-id')); });
    }
    renderPagination(totalPages);
    var measuredPageSize = calculatePageSize();
    if (allLetters.length && measuredPageSize !== pageSize) {
      pageSize = measuredPageSize;
      renderPage();
    }
  }

  apiRead('')
    .then(function(letters) {
      allLetters = letters;
      pageSize = allLetters.length || 1;
      renderPage();
      window.addEventListener('resize', function() {
        var nextPageSize = calculatePageSize();
        if (nextPageSize !== pageSize) {
          pageSize = nextPageSize;
          renderPage();
        }
      });
    }).catch(function(err) {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column: 1/-1">' +
          '<div class="empty-state-emoji">😢</div>' +
          '<h3>No se pudieron cargar las cartas</h3>' +
          '<p>' + escapeHTML(err.message || err) + '</p>' +
        '</div>';
    });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { window.loadLetters(); });
} else {
  window.loadLetters();
}
