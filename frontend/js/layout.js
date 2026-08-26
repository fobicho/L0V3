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
  } else {
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active',
        (page === 'inicio' && href === '/') ||
        (page === 'cartas' && href === '/cartas')
      );
    });
  }

  if (!hasLogout) {
    document.body.insertAdjacentHTML('beforeend', buildLogout());
  }

  updateCounter();
  if (!window._counterInterval) {
    window._counterInterval = setInterval(updateCounter, 1000);
  }
}

function runPageScripts(path) {
  if (path === '/carta' && typeof loadLetter === 'function') {
    loadLetter();
  }
}

let _navigating = false;

async function navigateTo(href, push) {
  if (_navigating) return;
  if (push === undefined) push = true;
  if (!href) return;

  const target = new URL(href, location.origin);
  if (target.pathname === location.pathname && target.search === location.search) return;
  if (target.origin !== location.origin) { window.location.href = href; return; }

  _navigating = true;
  try {
    const resp = await fetch(target.pathname + target.search);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const html = await resp.text();

    const doc = new DOMParser().parseFromString(html, 'text/html');

    const scriptsToLoad = [...doc.querySelectorAll('script[src]')].filter(s => !s.getAttribute('src').includes('layout.js'));
    const inlineScripts = [...doc.querySelectorAll('script:not([src])')].filter(s => s.textContent.trim());

    doc.querySelectorAll('script').forEach(s => s.remove());
    document.body.innerHTML = doc.body.innerHTML;

    const loads = scriptsToLoad.map(old => {
      const s = document.createElement('script');
      s.src = old.getAttribute('src');
      document.body.appendChild(s);
      return new Promise(r => { s.onload = r; s.onerror = r; });
    });
    if (loads.length) await Promise.all(loads);

    inlineScripts.forEach(old => {
      const s = document.createElement('script');
      s.textContent = old.textContent;
      document.body.appendChild(s);
    });

    if (push) history.pushState({}, '', href);

    initLayout(target.pathname);
    runPageScripts(target.pathname);

    window.scrollTo(0, 0);
  } catch (err) {
    window.location.href = href;
  } finally {
    _navigating = false;
  }
}

initLayout();

document.addEventListener('click', e => {
  if (e.defaultPrevented) return;
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
  if (link.target === '_blank') return;
  e.preventDefault();
  navigateTo(href);
});

window.addEventListener('popstate', () => {
  navigateTo(location.pathname + location.search, false);
});

document.addEventListener('DOMContentLoaded', () => {
  if (typeof getToken === 'function' && location.pathname !== '/acceso' && location.pathname !== '/admin') {
    if (!getToken()) {
      location.href = '/acceso';
      return;
    }
  }
  runPageScripts(location.pathname);
});
