(function () {
  let pistaCount = 0;
  const pistaBtn = document.getElementById('pista-btn');
  const hintText = document.getElementById('hint-text');

  function showPistaMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'pista-msg';
    msg.textContent = text;
    const rect = pistaBtn.getBoundingClientRect();
    msg.style.left = (rect.right + 24) + 'px';
    msg.style.top = (rect.top - 10) + 'px';
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2500);
  }

  function setupHint() {
    if (!pistaBtn || !hintText) return;
    pistaBtn.addEventListener('click', () => {
      pistaCount++;
      const pop = document.createElement('div');
      pop.className = 'click-popup';
      pop.textContent = pistaCount;
      const rect = pistaBtn.getBoundingClientRect();
      pop.style.left = (rect.left + Math.random() * 110) + 'px';
      pop.style.top = (rect.top - 24 - Math.random() * 90) + 'px';
      document.body.appendChild(pop);
      setTimeout(() => pop.remove(), 1000);
      if (pistaCount === 25) showPistaMessage('¡Tu puedes llegar a 100!');
      if (pistaCount >= 100) hintText.classList.add('show');
    });
  }

  function redirectIfAuthenticated() {
    const token = getToken();
    if (!token) return;
    const payload = parseJWT(token);
    if (!payload || payload.exp * 1000 <= Date.now()) {
      clearToken();
      localStorage.removeItem('role');
      sessionStorage.removeItem('role');
      return;
    }
    if (payload.role === 'admin') {
      window.location.href = '/admin';
      return;
    }
    let target = null;
    try { target = sessionStorage.getItem('redirectAfterLogin'); } catch {}
    if (target) {
      try { sessionStorage.removeItem('redirectAfterLogin'); } catch {}
      window.location.href = target;
    } else {
      window.location.href = '/inicio.html';
    }
  }

  function goAfterLogin(data) {
    let target = null;
    try { target = sessionStorage.getItem('redirectAfterLogin'); } catch {}
    try { sessionStorage.removeItem('redirectAfterLogin'); } catch {}
    if (data.role === 'admin') {
      window.location.href = target && target.startsWith('/admin') ? target : '/admin';
    } else {
      window.location.href = target && !target.startsWith('/admin') ? target : '/inicio.html';
    }
  }

  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorEl = document.getElementById('error-msg');
      errorEl.classList.remove('show');
      try {
        const data = await login(document.getElementById('secret').value);
        goAfterLogin(data);
      } catch (err) {
        errorEl.textContent = err.message || 'Error de conexión';
        errorEl.classList.add('show');
      }
    });
  }

  setupHint();
  redirectIfAuthenticated();
}());
