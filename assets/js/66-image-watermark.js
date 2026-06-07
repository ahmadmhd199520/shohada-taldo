(function () {
  'use strict';

  function markImageParent(img) {
    if (!img) return;

    const wrapper =
      img.closest('.martyr-image-wrap') ||
      img.closest('.gallery-main-frame');

    if (!wrapper) return;

    const isHidden = img.style.display === 'none';
    const hasSrc = String(img.getAttribute('src') || '').trim();

    if (hasSrc && !isHidden) {
      wrapper.classList.add('taldo-image-watermarked');
    } else {
      wrapper.classList.remove('taldo-image-watermarked');
    }
  }

  function scanImages() {
    document
      .querySelectorAll('.martyr-image-wrap img.martyr-image, .gallery-main-frame img.gallery-main-image, .gallery-main-frame img.detail-image')
      .forEach(function (img) {
        markImageParent(img);

        if (img.dataset.taldoWatermarkBound === '1') return;
        img.dataset.taldoWatermarkBound = '1';

        img.addEventListener('load', function () {
          markImageParent(img);
        });

        img.addEventListener('error', function () {
          const wrapper =
            img.closest('.martyr-image-wrap') ||
            img.closest('.gallery-main-frame');

          if (wrapper) {
            wrapper.classList.remove('taldo-image-watermarked');
          }
        });
      });
  }

  const observer = new MutationObserver(function () {
    requestAnimationFrame(scanImages);
  });

  function boot() {
    scanImages();

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
