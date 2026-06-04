(function() {
  const IMAGE_ONLY_TYPE = 'image_only';

  function isImageOnlyMessage(msg) {
    return String((msg && msg.message_type) || '').trim() === IMAGE_ONLY_TYPE;
  }

  function getMessageImageSrc(msg) {
    if (!msg) return '';
    const imageUrl = String(msg.image_url || '').trim();
    if (imageUrl) return imageUrl;

    const imageFileId = String(msg.image_file_id || '').trim();
    if (imageFileId) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(imageFileId)}&sz=w1600`;
    }

    return '';
  }

  function getMessageHiddenKey(msg) {
    return 'taldo_msg_hidden_' + (msg && msg.message_id ? msg.message_id : '');
  }

  function ensureImageOnlyOverlay() {
    let overlay = document.getElementById('taldoImageOnlyNoticeOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'taldoImageOnlyNoticeOverlay';
    overlay.className = 'taldo-image-only-notice-overlay d-none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="taldo-image-only-notice-stage">
        <img id="taldoImageOnlyNoticeImage" class="taldo-image-only-notice-image" alt="إعلام سريع">
        <button type="button" id="taldoImageOnlyNoticeClose" class="taldo-image-only-notice-close" aria-label="إغلاق">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>`;

    document.body.appendChild(overlay);
    return overlay;
  }

  function continueDynamicMessages() {
    const list = window.__dynamicMessageList || [];
    if (typeof currentDynamicMessageIndex === 'number') {
      currentDynamicMessageIndex++;
    } else {
      window.currentDynamicMessageIndex = 1;
    }

    if (list[currentDynamicMessageIndex]) {
      setTimeout(() => window.showDynamicMessage(list[currentDynamicMessageIndex], list), 250);
    }
  }

  function closeImageOnlyNotice() {
    const msg = window.__currentDynamicMessage;
    if (msg && msg.message_id) {
      localStorage.setItem(getMessageHiddenKey(msg), '1');
    }

    const overlay = document.getElementById('taldoImageOnlyNoticeOverlay');
    overlay?.classList.add('d-none');

    const img = document.getElementById('taldoImageOnlyNoticeImage');
    if (img) img.removeAttribute('src');

    continueDynamicMessages();
  }

  window.closeImageOnlyNotice = closeImageOnlyNotice;

  const previousShowDynamicMessage = window.showDynamicMessage;
  window.showDynamicMessage = function(msg, list) {
    if (!isImageOnlyMessage(msg)) {
      if (typeof previousShowDynamicMessage === 'function') return previousShowDynamicMessage(msg, list);
      return;
    }

    const src = getMessageImageSrc(msg);
    if (!src) {
      if (typeof previousShowDynamicMessage === 'function') return previousShowDynamicMessage(msg, list);
      return;
    }

    window.__currentDynamicMessage = msg;
    window.__dynamicMessageList = list || [];

    try {
      if (window.modals && modals.dynamicMessageModal) modals.dynamicMessageModal.hide();
    } catch (error) {}

    const overlay = ensureImageOnlyOverlay();
    const img = document.getElementById('taldoImageOnlyNoticeImage');
    const closeBtn = document.getElementById('taldoImageOnlyNoticeClose');

    if (img) {
      img.src = src;
      img.alt = msg.title || 'إعلام سريع';
    }

    if (closeBtn && closeBtn.dataset.bound !== '1') {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', closeImageOnlyNotice);
    }

    overlay.classList.remove('d-none');
  };

  function findFieldWrap(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return el.closest('.col-md-6, .col-md-4, .col-md-3, .col-md-2, .col-12') || el.parentElement;
  }

  function ensureImageOnlyTypeOption() {
    const select = document.getElementById('msgType');
    if (!select) return;

    if (!Array.from(select.options).some(opt => opt.value === IMAGE_ONLY_TYPE)) {
      select.insertAdjacentHTML('beforeend', '<option value="image_only">صورة مجردة / إعلام سريع</option>');
    }
  }

  function applyMessageTypeUi() {
    ensureImageOnlyTypeOption();

    const type = document.getElementById('msgType')?.value || 'notice';
    const isImageOnly = type === IMAGE_ONLY_TYPE;

    const titleWrap = findFieldWrap('msgTitle');
    const bodyWrap = findFieldWrap('msgBody');
    const martyrWrap = findFieldWrap('msgMartyrId');
    const allowWrap = findFieldWrap('msgAllowReply');
    const imageInput = document.getElementById('msgImage');
    const imageWrap = findFieldWrap('msgImage');

    [titleWrap, bodyWrap, martyrWrap, allowWrap].forEach(wrap => {
      if (wrap) wrap.classList.toggle('d-none', isImageOnly);
    });

    if (imageWrap) {
      const label = imageWrap.querySelector('label');
      if (label) label.textContent = isImageOnly ? 'صورة الإعلام السريع' : 'صورة مع الرسالة';
    }

    if (imageInput) {
      imageInput.required = isImageOnly;
    }

    const allow = document.getElementById('msgAllowReply');
    if (allow && isImageOnly) allow.checked = false;

    const martyr = document.getElementById('msgMartyrId');
    if (martyr && isImageOnly) martyr.value = '';

    let help = document.getElementById('imageOnlyMessageHelp');
    const typeWrap = findFieldWrap('msgType');
    if (!help && typeWrap) {
      help = document.createElement('div');
      help.id = 'imageOnlyMessageHelp';
      help.className = 'col-12 d-none';
      help.innerHTML = `<div class="taldo-image-only-help">
        هذا النوع يظهر للمستخدم كصورة فقط بدون حواف أو إطار. تظهر علامة × فوق زاوية الصورة، وعند الضغط عليها لا تظهر هذه الصورة للمستخدم مرة أخرى.
      </div>`;
      typeWrap.insertAdjacentElement('afterend', help);
    }

    if (help) help.classList.toggle('d-none', !isImageOnly);
  }

  const previousHandleMessageTypeChange = window.handleMessageTypeChange;
  window.handleMessageTypeChange = function() {
    if (typeof previousHandleMessageTypeChange === 'function') previousHandleMessageTypeChange();
    applyMessageTypeUi();
  };

  const previousRenderSettingsTab = window.renderSettingsTab;
  window.renderSettingsTab = function() {
    if (typeof previousRenderSettingsTab === 'function') previousRenderSettingsTab();
    enhanceSettingsFormAfterRender();
    enhanceMessageListLabels();
  };

  function enhanceSettingsFormAfterRender() {
    ensureImageOnlyTypeOption();

    const select = document.getElementById('msgType');
    if (select && select.dataset.imageOnlyBound !== '1') {
      select.dataset.imageOnlyBound = '1';
      select.addEventListener('change', applyMessageTypeUi);
    }

    applyMessageTypeUi();
  }

  function enhanceMessageListLabels() {
    const list = document.getElementById('messagesAdminList');
    if (!list) return;

    const messages = (window.__adminMessages || siteMessages || []);
    const cards = Array.from(list.children || []);

    cards.forEach((card, index) => {
      const msg = messages[index];
      if (!isImageOnlyMessage(msg)) return;

      const meta = card.querySelector('.small.text-muted');
      if (meta) {
        meta.textContent = `${msg.status || ''} - ترتيب: ${msg.sort_order || ''} - النوع: صورة مجردة / إعلام سريع`;
      }

      if (!card.querySelector('.image-only-admin-badge')) {
        const titleBox = card.querySelector('.fw-bold');
        titleBox?.insertAdjacentHTML('afterend', `
          <div class="mt-1 image-only-admin-badge">
            <span class="message-linked-badge"><i class="fa-solid fa-image"></i> تظهر كصورة فقط عند فتح الموقع</span>
          </div>`);
      }
    });
  }

  const previousSaveDashboardMessage = window.saveDashboardMessage;
  window.saveDashboardMessage = function() {
    const type = document.getElementById('msgType')?.value || 'notice';

    if (type !== IMAGE_ONLY_TYPE) {
      if (typeof previousSaveDashboardMessage === 'function') return previousSaveDashboardMessage();
      return;
    }

    const file = document.getElementById('msgImage')?.files?.[0];
    if (!file) {
      showToast('يرجى رفع صورة للإعلام السريع.');
      return;
    }

    const title = document.getElementById('msgTitle');
    const body = document.getElementById('msgBody');
    const allow = document.getElementById('msgAllowReply');
    const martyr = document.getElementById('msgMartyrId');

    if (title && !title.value.trim()) title.value = 'إعلام سريع';
    if (body && !body.value.trim()) body.value = 'إعلام سريع بصورة';
    if (allow) allow.checked = false;
    if (martyr) martyr.value = '';

    if (typeof previousSaveDashboardMessage === 'function') return previousSaveDashboardMessage();
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureImageOnlyOverlay();
    setTimeout(() => {
      enhanceSettingsFormAfterRender();
      enhanceMessageListLabels();
    }, 1200);
  });
})();
