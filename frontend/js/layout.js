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
  if (typeof getToken === 'function' && location.pathname !== '/acceso' && location.pathname !== '/admin') {
    if (!getToken()) {
      location.href = '/acceso';
      return;
    }
  }
  updateCounter();
  setInterval(updateCounter, 1000);
});
