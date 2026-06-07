(function () {
  'use strict';

  function clean(value) {
    return String(value || '').trim();
  }

  function escapeAttr(value) {
    return clean(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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

  function getMessageImageSrc(msg) {
    if (!msg) return '';

    const fileId =
      extractDriveId(msg.image_file_id) ||
      extractDriveId(msg.imageFileId) ||
      extractDriveId(msg.image_url) ||
      extractDriveId(msg.imageUrl);

    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w500`;
    }

    return clean(msg.image_url || msg.imageUrl || '');
  }

function getAdminMessages() {
  const result = [];

  function addList(list) {
    if (!Array.isArray(list)) return;

    list.forEach(function (msg) {
      if (!msg) return;

      const id = clean(msg.message_id || msg.messageId || '');
      const title = clean(msg.title || msg.message_title || '');

      if (!id && !title) return;

      result.push(msg);
    });
  }

  addList(window.__adminMessages);
  addList(window.adminMessages);
  addList(window.siteMessages);
  addList(window.__siteMessages);

  if (window.dashboardData && typeof window.dashboardData === 'object') {
    addList(window.dashboardData.messages);
    addList(window.dashboardData.siteMessages);
    addList(window.dashboardData.site_messages);
  }

  if (window.adminDashboardData && typeof window.adminDashboardData === 'object') {
    addList(window.adminDashboardData.messages);
    addList(window.adminDashboardData.siteMessages);
    addList(window.adminDashboardData.site_messages);
  }

  const seen = new Set();

  return result.filter(function (msg) {
    const key = clean(msg.message_id || msg.messageId || msg.title || msg.message_title || '');
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }

    return String(value || '').replace(/"/g, '\\"');
  }

  function findMessageElement(msg) {
    const id = clean(msg.message_id || msg.messageId);
    if (!id) return null;

    const selectors = [
      `[data-message-id="${cssEscape(id)}"]`,
      `[data-msg-id="${cssEscape(id)}"]`,
      `[data-taldo-message-id="${cssEscape(id)}"]`,
      `[data-messageid="${cssEscape(id)}"]`
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        return el.closest('.card, .list-group-item, tr, .message-card, .site-message-card, .admin-message-card') || el;
      }
    }

    const actionButton = document.querySelector(
      `[data-action][data-message-id="${cssEscape(id)}"], button[data-message-id="${cssEscape(id)}"], button[data-msg-id="${cssEscape(id)}"]`
    );

    if (actionButton) {
      return actionButton.closest('.card, .list-group-item, tr, .message-card, .site-message-card, .admin-message-card') || actionButton.parentElement;
    }

    return null;
  }

  function makePreviewHtml(src, title) {
    return `
      <div class="taldo-admin-message-image-preview" title="عرض صورة الرسالة">
        <img src="${escapeAttr(src)}" alt="${escapeAttr(title || 'صورة الرسالة')}" loading="lazy">
      </div>
    `;
  }

  function patchOneMessageImage(msg) {
    const src = getMessageImageSrc(msg);
    if (!src) return;

    const root = findMessageElement(msg);
    if (!root) return;

    if (root.querySelector('.taldo-admin-message-image-preview')) return;

    const html = makePreviewHtml(src, msg.title || '');

    if (root.tagName === 'TR') {
      const firstCell = root.querySelector('td');
      if (firstCell) {
        firstCell.insertAdjacentHTML('afterbegin', html);
      }
      return;
    }

    const body =
      root.querySelector('.card-body') ||
      root.querySelector('.message-body') ||
      root;

    body.insertAdjacentHTML('afterbegin', html);
  }

  function patchAdminMessageImages() {
    const messages = getAdminMessages();

    if (!messages.length) return;

    messages.forEach(patchOneMessageImage);
  }

  document.addEventListener('click', function (event) {
    const box = event.target.closest('.taldo-admin-message-image-preview');
    if (!box) return;

    const img = box.querySelector('img');
    const src = img?.getAttribute('src');

    if (src) {
      window.open(src.replace(/&sz=w\d+/, '&sz=w1200'), '_blank');
    }
  });

  const oldRenderSettingsTab =
    window.renderSettingsTab ||
    (typeof renderSettingsTab === 'function' ? renderSettingsTab : null);

  if (typeof oldRenderSettingsTab === 'function' && !oldRenderSettingsTab.__messageImagesWrapped) {
    window.renderSettingsTab = function () {
      const result = oldRenderSettingsTab.apply(this, arguments);

      setTimeout(patchAdminMessageImages, 0);
      requestAnimationFrame(patchAdminMessageImages);
      setTimeout(patchAdminMessageImages, 250);

      return result;
    };

    window.renderSettingsTab.__messageImagesWrapped = true;

    try {
      renderSettingsTab = window.renderSettingsTab;
    } catch (error) {}
  }

  const observer = new MutationObserver(function () {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(patchAdminMessageImages, 120);
  });

  document.addEventListener('DOMContentLoaded', function () {
    patchAdminMessageImages();

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  });

  setTimeout(patchAdminMessageImages, 800);
})();
