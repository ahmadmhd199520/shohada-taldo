// 70-mobile-app-download.js
// إضافة خيار "تنزيل تطبيق الجوال" إلى قائمة الثلاث نقاط مع مودال تنبيه قبل تحميل APK.
(function () {
  'use strict';

  const APK_URL = './downloads/shohada-taldo.apk';
  const MENU_PANEL_ID = 'taldoMobileHeaderMenuPanel';
  const MENU_BUTTON_ID = 'taldoMobileHeaderMenuBtn';
  const MENU_ITEM_ID = 'taldoMobileMenuDownloadApp';
  const MODAL_ID = 'taldoMobileAppDownloadModal';
  const STYLE_ID = 'taldoMobileAppDownloadStyle';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .taldo-app-download-menu-item i {
        color: #b9a779;
      }

      .taldo-app-download-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483600;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        direction: rtl;
        font-family: 'Tajawal', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: rgba(0, 0, 0, 0.58);
        backdrop-filter: blur(7px);
        -webkit-backdrop-filter: blur(7px);
      }

      .taldo-app-download-overlay.show {
        display: flex;
      }

      .taldo-app-download-card {
        width: min(94vw, 430px);
        overflow: hidden;
        border-radius: 24px;
        color: #edebe0;
        background:
          radial-gradient(circle at top right, rgba(66, 129, 119, 0.45), transparent 42%),
          linear-gradient(145deg, #002623 0%, #054239 58%, #002623 100%);
        border: 1px solid rgba(185, 167, 121, 0.42);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
        transform: translateY(10px) scale(0.98);
        opacity: 0;
        transition: transform 0.18s ease, opacity 0.18s ease;
      }

      .taldo-app-download-overlay.show .taldo-app-download-card {
        transform: translateY(0) scale(1);
        opacity: 1;
      }

      .taldo-app-download-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 18px 20px 12px;
        border-bottom: 1px solid rgba(185, 167, 121, 0.24);
      }

      .taldo-app-download-icon {
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 16px;
        color: #002623;
        background: linear-gradient(135deg, #edebe0, #b9a779);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.26);
      }

      .taldo-app-download-title {
        margin: 0;
        font-size: 1.18rem;
        font-weight: 800;
        line-height: 1.6;
        color: #ffffff;
      }

      .taldo-app-download-body {
        padding: 16px 20px 4px;
      }

      .taldo-app-download-body p {
        margin: 0 0 12px;
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.98rem;
        line-height: 1.9;
      }

      .taldo-app-download-note {
        border-radius: 18px;
        padding: 12px 14px;
        margin-top: 4px;
        background: rgba(237, 235, 224, 0.09);
        border: 1px solid rgba(237, 235, 224, 0.15);
      }

      .taldo-app-download-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-start;
        padding: 16px 20px 20px;
      }

      .taldo-app-download-btn {
        border: 0;
        border-radius: 999px;
        padding: 10px 18px;
        font-family: inherit;
        font-weight: 800;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
      }

      .taldo-app-download-btn:active {
        transform: translateY(1px);
      }

      .taldo-app-download-primary {
        color: #002623;
        background: linear-gradient(135deg, #edebe0, #b9a779);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.22);
      }

      .taldo-app-download-secondary {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.18);
      }

      .taldo-app-download-primary:hover,
      .taldo-app-download-secondary:hover {
        opacity: 0.94;
      }

      body:not(.dark-mode) .taldo-app-download-card {
        color: #3d3a3b;
        background:
          radial-gradient(circle at top right, rgba(66, 129, 119, 0.18), transparent 42%),
          linear-gradient(145deg, #ffffff 0%, #edebe0 100%);
        border-color: rgba(5, 66, 57, 0.18);
      }

      body:not(.dark-mode) .taldo-app-download-title {
        color: #002623;
      }

      body:not(.dark-mode) .taldo-app-download-body p {
        color: #3d3a3b;
      }

      body:not(.dark-mode) .taldo-app-download-note {
        background: rgba(5, 66, 57, 0.07);
        border-color: rgba(5, 66, 57, 0.12);
      }

      body:not(.dark-mode) .taldo-app-download-secondary {
        color: #054239;
        background: rgba(5, 66, 57, 0.08);
        border-color: rgba(5, 66, 57, 0.15);
      }

      @media (max-width: 480px) {
        .taldo-app-download-overlay {
          padding: 14px;
        }

        .taldo-app-download-card {
          border-radius: 22px;
        }

        .taldo-app-download-actions {
          flex-direction: column;
        }

        .taldo-app-download-btn {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function closeHeaderMenu() {
    const panel = document.getElementById(MENU_PANEL_ID);
    const btn = document.getElementById(MENU_BUTTON_ID);
    if (panel) panel.classList.remove('show');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'taldo-app-download-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'taldoAppDownloadTitle');
    modal.innerHTML = `
      <div class="taldo-app-download-card" role="document">
        <div class="taldo-app-download-header">
          <div class="taldo-app-download-icon" aria-hidden="true">
            <i class="fa-solid fa-mobile-screen-button"></i>
          </div>
          <h3 id="taldoAppDownloadTitle" class="taldo-app-download-title">تنبيه قبل تنزيل التطبيق</h3>
        </div>
        <div class="taldo-app-download-body">
          <p>هذا التطبيق غير منشور حاليًا على Google Play، لذلك قد تظهر لك بعض الرسائل التحذيرية أثناء التثبيت على الهاتف.</p>
          <p class="taldo-app-download-note">يرجى تنزيل التطبيق فقط من الموقع الرسمي لأرشيف شهداء تلدو. عند ظهور رسالة التحذير، اختر السماح بالتثبيت أو التثبيت على أي حال لإكمال تثبيت التطبيق بنجاح.</p>
        </div>
        <div class="taldo-app-download-actions">
          <button type="button" id="taldoAppDownloadStartBtn" class="taldo-app-download-btn taldo-app-download-primary">
            <i class="fa-solid fa-download ms-1"></i>
            تنزيل
          </button>
          <button type="button" id="taldoAppDownloadCancelBtn" class="taldo-app-download-btn taldo-app-download-secondary">
            إلغاء
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });

    modal.querySelector('#taldoAppDownloadCancelBtn')?.addEventListener('click', closeModal);
    modal.querySelector('#taldoAppDownloadStartBtn')?.addEventListener('click', function () {
      startDownload();
      closeModal();
    });

    return modal;
  }

  function showModal() {
    injectStyle();
    const modal = ensureModal();
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    setTimeout(function () {
      modal.querySelector('#taldoAppDownloadStartBtn')?.focus();
    }, 40);
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  function startDownload() {
    const link = document.createElement('a');
    link.href = APK_URL;
    link.download = 'shohada-taldo.apk';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function ensureMenuItem() {
    const panel = document.getElementById(MENU_PANEL_ID);
    if (!panel) return false;

    if (document.getElementById(MENU_ITEM_ID)) return true;

    const item = document.createElement('button');
    item.type = 'button';
    item.id = MENU_ITEM_ID;
    item.className = 'taldo-mobile-menu-item taldo-app-download-menu-item';
    item.innerHTML = '<i class="fa-solid fa-download"></i><span>تنزيل تطبيق الجوال</span>';
    item.addEventListener('click', function () {
      closeHeaderMenu();
      showModal();
    });

    const divider = panel.querySelector('.taldo-mobile-menu-divider');
    const aboutItem = panel.querySelector('#taldoMobileMenuAbout');

    if (divider) {
      panel.insertBefore(item, divider);
    } else if (aboutItem && aboutItem.nextSibling) {
      panel.insertBefore(item, aboutItem.nextSibling);
    } else {
      panel.appendChild(item);
    }

    return true;
  }

  function boot() {
    injectStyle();
    ensureModal();
    ensureMenuItem();

    const observer = new MutationObserver(function () {
      ensureMenuItem();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(ensureMenuItem, 300);
    setTimeout(ensureMenuItem, 1000);
    setTimeout(ensureMenuItem, 2200);
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeModal();
  });

  window.openTaldoMobileAppDownloadModal = showModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
