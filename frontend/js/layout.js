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

document.addEventListener('DOMContentLoaded', () => {
  const currentPath = location.pathname.replace(/\/+$/, '') || '/';
  if (typeof getToken === 'function' && currentPath !== '/login' && currentPath !== '/admin') {
    if (!getToken()) {
      try { sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search); } catch {}
      location.href = '/login';
      return;
    }
  }
  updateCounter();
  setInterval(updateCounter, 1000);

  const sidebar = document.querySelector('.sidebar');
  const toggle = document.querySelector('.sidebar-toggle');
  if (sidebar && toggle) {
    toggle.addEventListener('click', () => {
      const open = sidebar.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      toggle.textContent = open ? '×' : '☰';
    });
    sidebar.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        sidebar.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menú');
        toggle.textContent = '☰';
      });
    });
  }
});
