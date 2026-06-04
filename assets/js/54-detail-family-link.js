(function() {
  const STYLE_ID = 'taldoDetailFamilyLinkStyles';

  function safeText(value) {
    return String(value || '').trim();
  }

  function injectFamilyLinkStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #detailsContainer .taldo-detail-family-link-wrap {
        display: flex !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
      }

      #detailsContainer .taldo-detail-family-link {
        appearance: none !important;
        border: 0 !important;
        background: transparent !important;
        color: var(--bs-primary, #0d6efd) !important;
        padding: 0 !important;
        margin: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        cursor: pointer !important;
        font: inherit !important;
        font-weight: 700 !important;
        text-decoration: none !important;
        line-height: 1.6 !important;
      }

      #detailsContainer .taldo-detail-family-link:hover,
      #detailsContainer .taldo-detail-family-link:focus {
        color: var(--bs-link-hover-color, #0a58ca) !important;
        text-decoration: underline !important;
      }

      #detailsContainer .taldo-detail-family-link i {
        font-size: 0.82em !important;
        opacity: 0.88 !important;
        transition: transform .18s ease !important;
      }

      #detailsContainer .taldo-detail-family-link:hover i,
      #detailsContainer .taldo-detail-family-link:focus i {
        transform: translateX(-2px) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getCurrentDetailFamilyName() {
    try {
      if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem && currentDetailsItem.family_name) {
        return safeText(currentDetailsItem.family_name);
      }
    } catch (error) {}

    const familyNode = document.querySelector('#detailsContainer .detail-box .taldo-detail-family-link') ||
      Array.from(document.querySelectorAll('#detailsContainer .detail-box .text-muted'))
        .find(el => /^\s*عائلة\s+/.test(el.textContent || ''));

    if (!familyNode) return '';

    return safeText((familyNode.textContent || '').replace(/^\s*عائلة\s+/, ''));
  }

  function goToFamilyPage(familyName) {
    familyName = safeText(familyName);
    if (!familyName) return;

    if (typeof window.openFamilyMartyrs === 'function') {
      window.openFamilyMartyrs(familyName);
      return;
    }

    try {
      if (typeof openFamilyMartyrs === 'function') {
        openFamilyMartyrs(familyName);
      }
    } catch (error) {}
  }

  function patchDetailFamilyLink() {
    injectFamilyLinkStyles();

    const detailsPage = document.getElementById('detailsPage');
    if (detailsPage && !detailsPage.classList.contains('active')) return;

    const familyName = getCurrentDetailFamilyName();
    if (!familyName) return;

    const familyWrap = Array.from(document.querySelectorAll('#detailsContainer .detail-box .text-muted'))
      .find(el => /^\s*عائلة\s+/.test(el.textContent || '') || el.textContent.includes(familyName));

    if (!familyWrap || familyWrap.dataset.familyLinkReady === '1') return;

    const preservedChildren = Array.from(familyWrap.children || []).map(child => child.cloneNode(true));

    familyWrap.dataset.familyLinkReady = '1';
    familyWrap.classList.add('taldo-detail-family-link-wrap');
    familyWrap.textContent = '';

    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'taldo-detail-family-link';
    link.title = 'عرض شهداء عائلة ' + familyName;
    link.setAttribute('aria-label', 'عرض شهداء عائلة ' + familyName);

    const text = document.createElement('span');
    text.textContent = 'عائلة ' + familyName;

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-arrow-left-long';
    icon.setAttribute('aria-hidden', 'true');

    link.appendChild(text);
    link.appendChild(icon);
    link.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      goToFamilyPage(familyName);
    });

    familyWrap.appendChild(link);

    preservedChildren.forEach(child => {
      if (child && !child.classList?.contains('taldo-detail-family-link')) {
        familyWrap.appendChild(child);
      }
    });
  }

  function wrapOpenMartyrDetails() {
    const oldOpen = window.openMartyrDetails || (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);
    if (typeof oldOpen !== 'function') return;
    if (oldOpen.__detailFamilyLinkWrapped === true) return;

    window.openMartyrDetails = function() {
      const result = oldOpen.apply(this, arguments);
      setTimeout(patchDetailFamilyLink, 0);
      requestAnimationFrame(patchDetailFamilyLink);
      setTimeout(patchDetailFamilyLink, 160);
      return result;
    };

    window.openMartyrDetails.__detailFamilyLinkWrapped = true;

    try {
      openMartyrDetails = window.openMartyrDetails;
    } catch (error) {}
  }

  document.addEventListener('DOMContentLoaded', function() {
    injectFamilyLinkStyles();
    wrapOpenMartyrDetails();
    setTimeout(function() {
      wrapOpenMartyrDetails();
      patchDetailFamilyLink();
    }, 1200);
  });

  injectFamilyLinkStyles();
  wrapOpenMartyrDetails();
})();
