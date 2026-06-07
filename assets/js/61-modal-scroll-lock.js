(function () {
  'use strict';

  let locked = false;
  let savedScrollY = 0;
  let savedScrollX = 0;

  function hasOpenModal() {
    return !!document.querySelector('.modal.show');
  }

  function getScrollY() {
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function getScrollX() {
    return window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0;
  }

  function lockPageScroll() {
    if (locked) return;

    savedScrollY = getScrollY();
    savedScrollX = getScrollX();
    locked = true;

    document.documentElement.classList.add('taldo-modal-scroll-locked');
    document.body.classList.add('taldo-modal-scroll-locked');

    /*
      لا نستخدم position: fixed هنا حتى لا تقفز الصفحة للأعلى.
      نكتفي بمنع overflow مع حفظ موضع السكرول وإرجاعه فورًا.
    */
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    window.scrollTo(savedScrollX, savedScrollY);
  }

  function unlockPageScroll() {
    if (!locked) return;
    if (hasOpenModal()) return;

    locked = false;

    document.documentElement.classList.remove('taldo-modal-scroll-locked');
    document.body.classList.remove('taldo-modal-scroll-locked');

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';

    window.scrollTo(savedScrollX, savedScrollY);
  }

  document.addEventListener('show.bs.modal', function () {
    savedScrollY = getScrollY();
    savedScrollX = getScrollX();
    lockPageScroll();

    requestAnimationFrame(function () {
      window.scrollTo(savedScrollX, savedScrollY);
    });
  });

  document.addEventListener('shown.bs.modal', function () {
    lockPageScroll();

    requestAnimationFrame(function () {
      window.scrollTo(savedScrollX, savedScrollY);
    });

    setTimeout(function () {
      window.scrollTo(savedScrollX, savedScrollY);
    }, 80);
  });

  document.addEventListener('hidden.bs.modal', function () {
    setTimeout(unlockPageScroll, 50);
  });

  /*
    منع روابط المودالات من القفز للأعلى إذا كانت href="#"
  */
  document.addEventListener('click', function (event) {
    const trigger = event.target.closest('[data-bs-toggle="modal"]');

    if (!trigger) return;

    const href = trigger.getAttribute('href');

    if (href === '#') {
      event.preventDefault();
    }

    savedScrollY = getScrollY();
    savedScrollX = getScrollX();
  }, true);
})();
