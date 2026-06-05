(function () {
  const btn = document.getElementById('taldoMobileHeaderMenuBtn');
  const panel = document.getElementById('taldoMobileHeaderMenuPanel');

  if (!btn || !panel) return;

  function positionTaldoMenu() {
    const gap = 8;
    const safe = 8;
    const rect = btn.getBoundingClientRect();

    const panelWidth = Math.min(
      panel.offsetWidth || 205,
      window.innerWidth - safe * 2
    );

    let left = rect.left;
    left = Math.max(safe, Math.min(left, window.innerWidth - panelWidth - safe));

    const top = Math.max(safe, rect.bottom + gap);

    panel.style.setProperty('--taldo-menu-left', left + 'px');
    panel.style.setProperty('--taldo-menu-top', top + 'px');
  }

  btn.addEventListener('click', function () {
    requestAnimationFrame(positionTaldoMenu);
    setTimeout(positionTaldoMenu, 0);
  });

  window.addEventListener('resize', function () {
    if (panel.classList.contains('show')) positionTaldoMenu();
  });

  window.addEventListener('scroll', function () {
    if (panel.classList.contains('show')) positionTaldoMenu();
  }, true);
})();
