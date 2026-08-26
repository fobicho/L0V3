const START_DATE = new Date(2024, 4, 28, 0, 0, 0);

function timeTogether(start, end) {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();
  let hours = end.getHours() - start.getHours();
  let minutes = end.getMinutes() - start.getMinutes();
  let seconds = end.getSeconds() - start.getSeconds();

  if (seconds < 0) { seconds += 60; minutes--; }
  if (minutes < 0) { minutes += 60; hours--; }
  if (hours < 0) { hours += 24; days--; }
  if (days < 0) {
    months--;
    const prev = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prev.getDate();
  }
  if (months < 0) { months += 12; years--; }

  return { years, months, days, hours, minutes, seconds };
}

function updateCounter() {
  const d = timeTogether(START_DATE, new Date());
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('c-years', d.years);
  set('c-months', d.months);
  set('c-days', d.days);
  set('c-hours', d.hours);
  set('c-minutes', d.minutes);
  set('c-seconds', d.seconds);
}

function buildSidebar(activePage) {
  const page = activePage || (location.pathname === '/cartas' ? 'cartas' : 'inicio');
  return `
  <aside class="sidebar">
    <div class="sidebar-counter">
      <h2>Nuestro tiempo juntos</h2>
      <div class="counter-grid">
        <div class="counter-item"><span id="c-years">0</span><small>Años</small></div>
        <div class="counter-item"><span id="c-months">0</span><small>Meses</small></div>
        <div class="counter-item"><span id="c-days">0</span><small>Días</small></div>
        <div class="counter-item"><span id="c-hours">0</span><small>Horas</small></div>
        <div class="counter-item"><span id="c-minutes">0</span><small>Minutos</small></div>
        <div class="counter-item"><span id="c-seconds">0</span><small>Segundos</small></div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <a href="/" class="nav-link ${page === 'inicio' ? 'active' : ''}">Inicio</a>
      <a href="/cartas" class="nav-link ${page === 'cartas' ? 'active' : ''}">Buzón</a>
    </nav>
  </aside>`;
}

function buildLogout() {
  return `<button class="logout-fixed" onclick="logout()">Cerrar sesión</button>`;
}

function initLayout(path) {
  document.title = 'Buzón';
  const hasSidebar = !!document.querySelector('.sidebar');
  const hasLogout = !!document.querySelector('.logout-fixed');

  const page = (path || location.pathname) === '/cartas' ? 'cartas' : 'inicio';
  if (!hasSidebar) {
    document.body.insertAdjacentHTML('afterbegin', buildSidebar(page));
  }

  if (!hasLogout) {
    document.body.insertAdjacentHTML('beforeend', buildLogout());
  }

  updateCounter();
  if (!window._counterInterval) {
    window._counterInterval = setInterval(updateCounter, 1000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof getToken === 'function' && location.pathname !== '/acceso' && location.pathname !== '/admin') {
    if (!getToken()) {
      location.href = '/acceso';
      return;
    }
  }
  initLayout();
});
