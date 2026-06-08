// 70-mobile-app-download.js
// إضافة خيار "تنزيل تطبيق الجوال" إلى قائمة الثلاث نقاط مع مودال بنفس نمط مودالات المشروع.
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
      /* توحيد خيار التنزيل مع شكل قائمة الثلاث نقاط */
      #${MENU_ITEM_ID} i,
      .taldo-app-download-menu-item i {
        color: #0d6efd;
      }

      #${MENU_ITEM_ID} span,
      .taldo-app-download-menu-item span {
        font-weight: 800;
      }

      /* المودال يعتمد على Bootstrap وعلى تنسيقات المشروع الأصلية: modal-content / intro-icon / btn */
      #${MODAL_ID} .modal-content {
        border: 0;
        border-radius: 26px;
        overflow: hidden;
        box-shadow: 0 0 18px 0 rgba(0, 0, 0, 0.45);
      }

      #${MODAL_ID} .taldo-app-download-text {
        color: var(--dark, #3d3a3b);
        font-size: 0.98rem;
        line-height: 1.95;
      }

      #${MODAL_ID} .taldo-app-download-note-box {
        border-radius: 18px;
        padding: 12px 14px;
        background: rgba(13, 110, 253, 0.06);
        border: 1px solid rgba(13, 110, 253, 0.10);
      }

      #${MODAL_ID} .taldo-app-download-actions {
        display: flex;
        gap: 10px;
      }

      #${MODAL_ID} .taldo-app-download-actions .btn {
        border-radius: 16px;
        font-weight: 800;
        padding-top: 10px;
        padding-bottom: 10px;
      }

      body.dark-mode #${MODAL_ID} .taldo-app-download-text {
        color: #f4faf8 !important;
      }

      body.dark-mode #${MODAL_ID} .taldo-app-download-note-box {
        background: rgba(255, 255, 255, 0.07) !important;
        border-color: rgba(255, 255, 255, 0.12) !important;
      }

      @media (max-width: 480px) {
        #${MODAL_ID} .modal-dialog {
          margin-left: 14px;
          margin-right: 14px;
        }

        #${MODAL_ID} .taldo-app-download-actions {
          flex-direction: column;
        }

        #${MODAL_ID} .taldo-app-download-actions .btn {
          width: 100% !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function closeHeaderMenu() {
    const panel = document.getElementById(MENU_PANEL_ID);
    const btn = document.getElementById(MENU_BUTTON_ID);

    if (panel) {
      panel.classList.remove('show', 'is-open', 'open', 'active');
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
    }

    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = MODAL_ID;
    modal.tabIndex = -1;
    modal.setAttribute('aria-labelledby', 'taldoAppDownloadTitle');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-body p-4 text-center">
            <div class="intro-icon bg-warning-subtle text-warning">
              <i class="fa-solid fa-mobile-screen-button"></i>
            </div>

            <h4 id="taldoAppDownloadTitle" class="fw-bold mb-3">تنبيه قبل تنزيل التطبيق</h4>

            <div class="text-start about-project-text taldo-app-download-text">
              <p class="mb-3">
                هذا التطبيق غير منشور حاليًا على Google Play، لذلك قد تظهر لك بعض الرسائل التحذيرية أثناء التثبيت على الهاتف.
              </p>

              <p class="mb-0 taldo-app-download-note-box">
                يرجى تنزيل التطبيق فقط من الموقع الرسمي لأرشيف شهداء تلدو. عند ظهور رسالة التحذير، اختر السماح بالتثبيت أو التثبيت على أي حال لإكمال تثبيت التطبيق بنجاح.
              </p>
            </div>

            <div class="taldo-app-download-actions mt-4">
              <button type="button" id="taldoAppDownloadCancelBtn" class="btn btn-outline-secondary w-50" data-bs-dismiss="modal">
                إلغاء
              </button>

              <button type="button" id="taldoAppDownloadStartBtn" class="btn btn-primary w-50">
                <i class="fa-solid fa-download ms-1"></i>
                تنزيل
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#taldoAppDownloadStartBtn')?.addEventListener('click', function () {
      startDownload();
      hideModal();
    });

    return modal;
  }

  function getBootstrapModal(modal) {
    if (!window.bootstrap || !window.bootstrap.Modal) return null;
    return window.bootstrap.Modal.getOrCreateInstance(modal);
  }

  function showModal() {
    injectStyle();
    const modal = ensureModal();
    const bsModal = getBootstrapModal(modal);

    if (bsModal) {
      bsModal.show();
      return;
    }

    // احتياط في حال لم يكن Bootstrap جاهزًا لأي سبب.
    modal.classList.add('show');
    modal.style.display = 'block';
    modal.removeAttribute('aria-hidden');
    document.body.classList.add('modal-open');
  }

  function hideModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    const bsModal = getBootstrapModal(modal);
    if (bsModal) {
      bsModal.hide();
      return;
    }

    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
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
      setTimeout(showModal, 80);
    });

    const divider = panel.querySelector('.taldo-mobile-menu-divider');
    const aboutItem = panel.querySelector('#taldoMobileMenuAbout');
    const darkModeItem = panel.querySelector('#taldoMobileMenuDarkMode');

    if (divider) {
      panel.insertBefore(item, divider);
    } else if (darkModeItem) {
      panel.insertBefore(item, darkModeItem);
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

  window.openTaldoMobileAppDownloadModal = showModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
