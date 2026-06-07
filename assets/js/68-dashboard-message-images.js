(function () {
  'use strict';

  function clean(value) {
    return String(value || '').trim();
  }

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(String(value || ''));
    }

    return String(value || '').replace(/(["\\])/g, '\\$1');
  }

  function extractDriveId(value) {
    const text = clean(value);
    if (!text) return '';

    let match = text.match(/[?&]id=([^&#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = text.match(/file\/d\/([^/?#]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    if (/^[A-Za-z0-9_-]{15,}$/.test(text)) return text;

    return '';
  }

  function imageSrcFromMessage(msg, size) {
    if (!msg) return '';

    const fileId =
      extractDriveId(msg.image_file_id) ||
      extractDriveId(msg.imageFileId) ||
      extractDriveId(msg.file_id) ||
      extractDriveId(msg.image_url) ||
      extractDriveId(msg.imageUrl);

    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size || 500}`;
    }

    return clean(msg.image_url || msg.imageUrl || '');
  }

  function addMessageList(list, target) {
    if (!Array.isArray(list)) return;

    list.forEach(msg => {
      if (!msg) return;

      const hasIdentity = clean(msg.message_id || msg.messageId || msg.title || msg.message_title);
      const hasImage = imageSrcFromMessage(msg, 500);

      if (hasIdentity && hasImage) target.push(msg);
    });
  }

  function getAdminMessagesForImages() {
    const result = [];

    addMessageList(window.__adminMessages, result);
    addMessageList(window.adminMessages, result);
    addMessageList(window.siteMessages, result);
    addMessageList(window.__siteMessages, result);

    try {
      if (typeof siteMessages !== 'undefined') addMessageList(siteMessages, result);
    } catch (error) {}

    if (window.dashboardData && typeof window.dashboardData === 'object') {
      addMessageList(window.dashboardData.messages, result);
      addMessageList(window.dashboardData.siteMessages, result);
      addMessageList(window.dashboardData.site_messages, result);
    }

    if (window.adminDashboardData && typeof window.adminDashboardData === 'object') {
      addMessageList(window.adminDashboardData.messages, result);
      addMessageList(window.adminDashboardData.siteMessages, result);
      addMessageList(window.adminDashboardData.site_messages, result);
    }

    const seen = new Set();

    return result.filter(msg => {
      const key = clean(msg.message_id || msg.messageId || msg.title || msg.message_title || imageSrcFromMessage(msg, 500));
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeTextForSearch(value) {
    return clean(value).replace(/\s+/g, ' ');
  }

  function elementLooksLikeMessageCard(el, msg) {
    if (!el || !msg) return false;

    const title = normalizeTextForSearch(msg.title || msg.message_title || '');
    const body = normalizeTextForSearch(msg.body || msg.message_body || '');
    const text = normalizeTextForSearch(el.textContent || '');

    if (!title || !text.includes(title)) return false;

    if (body) {
      const bodyPart = body.slice(0, 40);
      if (bodyPart && !text.includes(bodyPart)) return false;
    }

    return true;
  }

  function candidateMessageContainers() {
    return [
      document.getElementById('messagesAdminList'),
      document.getElementById('dashboardSettingsTab'),
      document.getElementById('settingsTab'),
      document.getElementById('settingsPage'),
      document.getElementById('dashboardPage'),
      document.body
    ].filter(Boolean);
  }

  function findMessageElementByContent(msg) {
    const selector = [
      '.taldo-message-admin-card',
      '.site-message-card',
      '.admin-message-card',
      '.message-card',
      '.card',
      '.list-group-item',
      '.border.rounded-4',
      '.rounded-4.border',
      'tr'
    ].join(',');

    for (const container of candidateMessageContainers()) {
      const candidates = Array.from(container.querySelectorAll(selector));

      for (const candidate of candidates) {
        if (candidate.querySelector('.taldo-admin-message-image-preview')) continue;
        if (elementLooksLikeMessageCard(candidate, msg)) return candidate;
      }
    }

    return null;
  }

  function findMessageElement(msg) {
    const id = clean(msg.message_id || msg.messageId);

    if (id) {
      const selectors = [
        `[data-message-id="${cssEscape(id)}"]`,
        `[data-msg-id="${cssEscape(id)}"]`,
        `[data-taldo-message-id="${cssEscape(id)}"]`,
        `[data-messageid="${cssEscape(id)}"]`,
        `[data-message-id='${cssEscape(id)}']`,
        `[data-msg-id='${cssEscape(id)}']`
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          return el.closest('.taldo-message-admin-card, .card, .list-group-item, tr, .message-card, .site-message-card, .admin-message-card, .rounded-4, .border') || el;
        }
      }

      const onclickButtons = Array.from(document.querySelectorAll('#messagesAdminList button[onclick], #dashboardSettingsTab button[onclick]'));
      const relatedButton = onclickButtons.find(btn => String(btn.getAttribute('onclick') || '').includes(id));

      if (relatedButton) {
        return relatedButton.closest('.taldo-message-admin-card, .card, .list-group-item, tr, .message-card, .site-message-card, .admin-message-card, .rounded-4, .border') || relatedButton.parentElement;
      }
    }

    return findMessageElementByContent(msg);
  }

  function makePreviewHtml(src, msg) {
    const bigSrc = src.replace(/&sz=w\d+/g, '&sz=w1200').replace(/\?sz=w\d+/g, '?sz=w1200');
    const title = msg.title || msg.message_title || 'صورة الرسالة';

    return `
      <a class="taldo-admin-message-image-preview" href="${escapeAttr(bigSrc)}" target="_blank" rel="noopener" title="عرض صورة الرسالة">
        <img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" loading="lazy">
      </a>
    `;
  }

  function patchOneMessageImage(msg) {
    const src = imageSrcFromMessage(msg, 500);
    if (!src) return;

    const root = findMessageElement(msg);
    if (!root) return;

    if (root.querySelector('.taldo-admin-message-image-preview')) return;

    const html = makePreviewHtml(src, msg);

    if (root.tagName === 'TR') {
      const firstCell = root.querySelector('td');
      if (firstCell) firstCell.insertAdjacentHTML('afterbegin', html);
      return;
    }

    const target =
      root.querySelector('.card-body') ||
      root.querySelector('.message-body') ||
      root.querySelector(':scope > .d-flex') ||
      root;

    target.insertAdjacentHTML('afterbegin', html);
    root.classList.add('taldo-message-has-image-preview');
  }

  function patchAdminMessageImages() {
    const messages = getAdminMessagesForImages();
    if (!messages.length) return;

    messages.forEach(patchOneMessageImage);
  }

  function runSoon() {
    setTimeout(patchAdminMessageImages, 0);
    requestAnimationFrame(patchAdminMessageImages);
    setTimeout(patchAdminMessageImages, 200);
    setTimeout(patchAdminMessageImages, 650);
  }

  const oldRenderSettingsTab =
    window.renderSettingsTab ||
    (typeof renderSettingsTab === 'function' ? renderSettingsTab : null);

  if (typeof oldRenderSettingsTab === 'function' && !oldRenderSettingsTab.__taldoMessageImagesWrapped) {
    window.renderSettingsTab = function () {
      const result = oldRenderSettingsTab.apply(this, arguments);
      runSoon();
      return result;
    };

    window.renderSettingsTab.__taldoMessageImagesWrapped = true;

    try {
      renderSettingsTab = window.renderSettingsTab;
    } catch (error) {}
  }

  const observer = new MutationObserver(function () {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(patchAdminMessageImages, 140);
  });

  function boot() {
    runSoon();

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

  window.taldoPatchAdminMessageImages = patchAdminMessageImages;
})();
