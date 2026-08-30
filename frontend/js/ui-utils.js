function calculatePageSize(containerSelector, itemSelector) {
  const list = document.querySelector(containerSelector);
  const sample = list && list.querySelector(itemSelector);
  if (!sample) return 1;
  const styles = window.getComputedStyle(list);
  const columns = styles.gridTemplateColumns.split(' ').length;
  const gap = parseFloat(styles.rowGap) || parseFloat(styles.gap) || 0;
  const itemHeight = sample.getBoundingClientRect().height;
  const listTop = list.getBoundingClientRect().top;
  const padding = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
  const rows = Math.floor((window.innerHeight - listTop - 96 - padding + gap) / (itemHeight + gap));
  return Math.max(1, columns * Math.max(1, rows));
}
