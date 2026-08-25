window.openLetterModal = function(id) {
  localStorage.setItem('read_' + id, '1');
  var badge = document.querySelector('.card[data-letter-id="' + id + '"] .card-badge');
  if (badge) badge.remove();

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    '<div class="modal-content">' +
      '<div class="modal-body">' +
        '<div class="loading"><div class="loading-heart">💌</div><p>Cargando carta...</p></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', handler); }
  });

  _supabase.from('letters')
    .select('id, title, content, mood, created_at, updated_at')
    .eq('id', id)
    .single()
    .then(function(result) {
      if (result.error) throw result.error;
      var letter = result.data;
      var body = overlay.querySelector('.modal-body');
      body.innerHTML =
        '<div class="letter-paper">' +
          '<div class="letter-header">' +
            '<h1 class="letter-title">' + letter.title + '</h1>' +
            '<div class="letter-divider"></div>' +
          '</div>' +
          '<div class="letter-content">' + letter.content + '</div>' +
          '<div class="letter-footer">' +
            '<div class="letter-divider"></div>' +
            '<span class="letter-date">' + formatDate(letter.created_at) + '</span>' +
          '</div>' +
        '</div>';
    }).catch(function(err) {
      overlay.querySelector('.modal-body').innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-emoji">😢</div>' +
          '<h3>Carta no encontrada</h3>' +
          '<p>' + (err.message || err) + '</p>' +
        '</div>';
    });
};

window.loadLetters = function() {
  var grid = document.getElementById('letters-grid');
  if (!grid) return;

  _supabase.from('letters')
    .select('id, title, content, mood, created_at, updated_at')
    .order('created_at', { ascending: false })
    .then(function(result) {
      if (result.error) throw result.error;
      var letters = result.data;
      if (letters.length === 0) {
        grid.innerHTML =
          '<div class="empty-state" style="grid-column: 1/-1">' +
            '<div class="empty-state-emoji">💌</div>' +
            '<h3>Aún no hay cartas</h3>' +
            '<p>Pronto llegarán cartas llenas de amor...</p>' +
          '</div>';
        return;
      }
      grid.innerHTML = letters.map(function(letter) {
        var read = localStorage.getItem('read_' + letter.id) === '1';
        return '<div class="card" data-letter-id="' + letter.id + '">' +
          '<div class="card-envelope">💌</div>' +
          (!read ? '<div class="card-badge">¡Nueva!</div>' : '') +
        '</div>';
      }).join('');

      var cards = grid.querySelectorAll('.card');
      for (var i = 0; i < cards.length; i++) {
        (function(card) {
          card.addEventListener('click', function() {
            window.openLetterModal(card.getAttribute('data-letter-id'));
          });
        })(cards[i]);
      }
    }).catch(function(err) {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column: 1/-1">' +
          '<div class="empty-state-emoji">😢</div>' +
          '<h3>No se pudieron cargar las cartas</h3>' +
          '<p>' + (err.message || err) + '</p>' +
        '</div>';
    });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { window.loadLetters(); });
} else {
  window.loadLetters();
}
