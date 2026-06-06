(function () {
  let locked = false;
  let savedScrollY = 0;

  function hasOpenModal() {
    return !!document.querySelector('.modal.show');
  }

  function lockPageScroll() {
    if (locked) return;

    savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    locked = true;

    document.documentElement.classList.add('taldo-modal-scroll-locked');
    document.body.classList.add('taldo-modal-scroll-locked');

    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  function unlockPageScroll() {
    if (!locked) return;
    if (hasOpenModal()) return;

    locked = false;

    document.documentElement.classList.remove('taldo-modal-scroll-locked');
    document.body.classList.remove('taldo-modal-scroll-locked');

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';

    window.scrollTo(0, savedScrollY);
  }

  document.addEventListener('show.bs.modal', function () {
    lockPageScroll();
  });

  document.addEventListener('shown.bs.modal', function () {
    lockPageScroll();
  });

  document.addEventListener('hidden.bs.modal', function () {
    setTimeout(unlockPageScroll, 50);
  });

  // احتياط للمودالات التي قد تُفتح بإضافة class show بدون حدث Bootstrap
  const observer = new MutationObserver(function () {
    if (hasOpenModal()) {
      lockPageScroll();
    } else {
      setTimeout(unlockPageScroll, 50);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
})();
