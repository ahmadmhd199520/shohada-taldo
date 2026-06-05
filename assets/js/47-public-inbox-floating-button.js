(function() {
  'use strict';

  const INBOX_STYLE_ID = 'taldoPublicInboxStyle';
  let inboxSubmitting = false;

  function isAdminMode() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function safeHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);

    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeAttr(value) {
    if (typeof escapeAttr === 'function') return escapeAttr(value);

    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function installInboxCss() {
    if (document.getElementById(INBOX_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = INBOX_STYLE_ID;
    style.textContent = `
      .taldo-public-inbox-floating-btn {
        position: fixed;
        right: 18px;
        bottom: 22px;
        z-index: 1055;
        width: 56px;
        height: 56px;
        border: 0;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        background: linear-gradient(135deg, #054239, #428177);
        box-shadow: 0 14px 34px rgba(0, 38, 35, 0.28);
        cursor: pointer;
        transition: transform .18s ease, box-shadow .18s ease;
      }

      .taldo-public-inbox-floating-btn:hover,
      .taldo-public-inbox-floating-btn:focus {
        transform: translateY(-2px);
        box-shadow: 0 18px 40px rgba(0, 38, 35, 0.36);
      }

      .taldo-public-inbox-floating-btn i {
        font-size: 1.25rem;
      }

      .taldo-public-inbox-hidden {
        display: none !important;
      }

      .taldo-inbox-dashboard-dot-host {
  position: relative !important;
}

.taldo-dashboard-inbox-count-bubble {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #16a34a, #20c997);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  border: 2px solid #fff;
  box-shadow: 0 0 0 4px rgba(32, 201, 151, .22), 0 8px 18px rgba(0, 0, 0, .18);
  z-index: 20;
  pointer-events: none;
}

.taldo-dashboard-inbox-count-bubble.is-hidden {
  display: none !important;
}

body.dark-mode .taldo-dashboard-inbox-count-bubble,
[data-theme="dark"] .taldo-dashboard-inbox-count-bubble {
  border-color: #10231f;
  box-shadow: 0 0 0 4px rgba(32, 201, 151, .18), 0 8px 18px rgba(0, 0, 0, .35);
}

      .taldo-inbox-message-cell {
        white-space: pre-line;
        line-height: 1.8;
      }

      .taldo-inbox-count-badge {
        font-size: .75rem;
      }

      @media (max-width: 576px) {
        .taldo-public-inbox-floating-btn {
          right: 14px;
          bottom: 18px;
          width: 52px;
          height: 52px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureInboxModal() {
    if (document.getElementById('taldoPublicInboxModal')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="taldoPublicInboxModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 rounded-4">
            <div class="modal-body p-3">
              <input
                type="text"
                class="form-control mb-2"
                id="taldoInboxSenderName"
                placeholder="الاسم - اختياري"
                autocomplete="name"
              >

              <textarea
                class="form-control"
                id="taldoInboxMessageText"
                rows="5"
                placeholder="اكتب رسالتك لفريق العمل هنا"
              ></textarea>
            </div>

            <div class="modal-footer border-0 pt-0">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                إلغاء
              </button>
              <button type="button" class="btn btn-success" id="taldoInboxSendBtn" onclick="submitTaldoInboxMessage()">
                إرسال
              </button>
            </div>
          </div>
        </div>
      </div>
    `);
  }

  function ensureThanksModal() {
    if (document.getElementById('taldoInboxThanksModal')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="taldoInboxThanksModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 rounded-4 text-center">
            <div class="modal-body p-4">
              <div class="mb-3">
                <i class="fa-solid fa-circle-check text-success" style="font-size:2.4rem;"></i>
              </div>
              <div class="fw-bold fs-5">
                شكرًا لكم وصلت الرسالة لفريق العمل
              </div>
            </div>
            <div class="modal-footer border-0 pt-0 justify-content-center">
              <button type="button" class="btn btn-success px-4" data-bs-dismiss="modal">
                موافق
              </button>
            </div>
          </div>
        </div>
      </div>
    `);
  }

  function ensureFloatingButton() {
    if (document.getElementById('taldoPublicInboxFloatingBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'taldoPublicInboxFloatingBtn';
    btn.className = 'taldo-public-inbox-floating-btn';
    btn.title = 'إرسال رسالة لفريق العمل';
    btn.setAttribute('aria-label', 'إرسال رسالة لفريق العمل');
    btn.innerHTML = `<i class="fa-solid fa-envelope"></i>`;
    btn.onclick = openTaldoInboxModal;

    document.body.appendChild(btn);
  }

  function openTaldoInboxModal() {
    ensureInboxModal();

    const name = document.getElementById('taldoInboxSenderName');
    const text = document.getElementById('taldoInboxMessageText');

    if (name) name.value = '';
    if (text) text.value = '';

    const modalEl = document.getElementById('taldoPublicInboxModal');

    try {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    } catch (e) {
      modalEl.classList.add('show');
      modalEl.style.display = 'block';
    }
  }

  window.openTaldoInboxModal = openTaldoInboxModal;

  function showInboxThanks() {
    ensureThanksModal();

    const modalEl = document.getElementById('taldoInboxThanksModal');

    try {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } catch (e) {
      showToast('شكرًا لكم وصلت الرسالة لفريق العمل');
    }
  }

  function setSendLoading(loading) {
    const btn = document.getElementById('taldoInboxSendBtn');
    if (!btn) return;

    btn.disabled = !!loading;
    btn.innerHTML = loading
      ? `<span class="spinner-border spinner-border-sm ms-1"></span> إرسال`
      : 'إرسال';
  }

  window.submitTaldoInboxMessage = async function() {
    if (inboxSubmitting) return;

    const senderName = document.getElementById('taldoInboxSenderName')?.value || '';
    const messageText = document.getElementById('taldoInboxMessageText')?.value.trim() || '';

    if (!messageText) {
      showToast('يرجى كتابة الرسالة.');
      return;
    }

    inboxSubmitting = true;
    setSendLoading(true);

    try {
      const res = await apiRequest('submitInboxMessage', {
        sender_name: senderName,
        message_text: messageText
      });

      if (!res || res.success === false) {
        showToast(res?.message || 'تعذر إرسال الرسالة.');
        return;
      }

      try {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('taldoPublicInboxModal')).hide();
      } catch (e) {}

      showInboxThanks();

      if (isAdminMode()) {
        setTimeout(loadInboxBadgeSilently, 500);
      }
    } catch (error) {
      showToast(error.message || 'تعذر إرسال الرسالة.');
    } finally {
      inboxSubmitting = false;
      setSendLoading(false);
    }
  };

  function getInboxMessages() {
    return Array.isArray(window.__inboxMessages) ? window.__inboxMessages : [];
  }

  function getVisibleInboxMessages() {
    return getInboxMessages().filter(function(item) {
      return String(item.status || 'active').trim() !== 'hidden';
    });
  }

  function unreadInboxCount() {
    return getVisibleInboxMessages().length;
  }

  function normalizeInboxText(value) {
  if (typeof normalizeText === 'function') {
    return normalizeText(value || '');
  }

  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْ]/g, '');
}

function getInboxItemStatus(item) {
  const status = String(item.status || 'active').trim();
  return status === 'hidden' ? 'hidden' : 'active';
}

function getFilteredInboxMessages() {
  const search = normalizeInboxText(
    document.getElementById('inboxMessagesSearchInput')?.value || ''
  );

  const statusFilter =
    document.getElementById('inboxMessagesStatusFilter')?.value ?? 'active';

  const sortBy =
    document.getElementById('inboxMessagesSortSelect')?.value || 'newest';

  let list = getInboxMessages().slice();

  if (statusFilter === 'active') {
    list = list.filter(function(item) {
      return getInboxItemStatus(item) === 'active';
    });
  } else if (statusFilter === 'hidden') {
    list = list.filter(function(item) {
      return getInboxItemStatus(item) === 'hidden';
    });
  }

  if (search) {
    list = list.filter(function(item) {
      const content = normalizeInboxText([
        item.sender_name,
        item.message_text,
        item.created_at,
        item.message_id
      ].join(' '));

      return content.includes(search);
    });
  }

  if (sortBy === 'oldest') {
    list.sort(function(a, b) {
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
  } else if (sortBy === 'sender') {
    list.sort(function(a, b) {
      return String(a.sender_name || '').localeCompare(String(b.sender_name || ''), 'ar');
    });
  } else {
    list.sort(function(a, b) {
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }

  return list;
}

window.resetInboxMessagesAndRender = function() {
  renderInboxTable();
};

  function findDashboardButtons() {
    return Array.from(document.querySelectorAll('button, a')).filter(function(el) {
      const text = String(el.textContent || '').trim();
      const onclick = String(el.getAttribute('onclick') || '');

      return (
        el.id === 'adminBtn' ||
        el.id === 'adminPanelBtn' ||
        onclick.includes('openDashboardPage') ||
        text.includes('لوحة التحكم')
      );
    });
  }

  function updateDashboardInboxDot() {
  const count = isAdminMode() ? unreadInboxCount() : 0;
  const has = count > 0;
  const label = count > 99 ? '99+' : String(count);

  const dashboardTabCount = document.getElementById('dashInboxCount');
  if (dashboardTabCount) dashboardTabCount.textContent = count;

  findDashboardButtons().forEach(function(btn) {
    btn.classList.add('taldo-inbox-dashboard-dot-host');
    btn.classList.toggle('taldo-has-inbox-messages', has);

    let badge = btn.querySelector('.taldo-dashboard-inbox-count-bubble');

    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'taldo-dashboard-inbox-count-bubble is-hidden';
      btn.appendChild(badge);
    }

    badge.textContent = label;
    badge.setAttribute('aria-label', count + ' رسائل غير مقروءة');
    badge.classList.toggle('is-hidden', !has);
  });
}

  async function loadInboxBadgeSilently() {
    if (!isAdminMode()) {
      updateDashboardInboxDot();
      return;
    }

    try {
      const res = await apiRequest('getAdminDashboardData', {
        forceFresh: true,
        __cacheBust: Date.now()
      });

      if (res && res.success) {
        window.__inboxMessages = res.inboxMessages || window.__inboxMessages || [];
        updateDashboardInboxDot();

        if (document.getElementById('dashboardInboxTab')?.classList.contains('active')) {
          renderInboxTable();
        }
      }
    } catch (e) {}
  }

  function ensureDashboardInboxTab() {
    const tabs =
      document.querySelector('.dashboard-tabs') ||
      document.querySelector('#dashboardPage .nav-tabs') ||
      document.querySelector('#dashboardPage .nav-pills');

    if (tabs && !document.getElementById('dashInboxTabBtn')) {
      tabs.insertAdjacentHTML('beforeend', `
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="dashInboxTabBtn" type="button" onclick="showDashboardTab('inbox')">
            <i class="fa-solid fa-inbox ms-1"></i>
            صندوق الوارد
            <span class="badge text-bg-success taldo-inbox-count-badge ms-1" id="dashInboxCount">0</span>
          </button>
        </li>
      `);
    }

    const dash = document.getElementById('dashboardPage');

    if (dash && !document.getElementById('dashboardInboxTab')) {
      dash.insertAdjacentHTML('beforeend', `
        <div id="dashboardInboxTab" class="dashboard-tab-pane d-none">
          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الاسم</th>
                  <th>الرسالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody id="inboxMessagesTableBody"></tbody>
            </table>
          </div>
        </div>
      `);
    }

    renderInboxTable();
  }

  function renderInboxTable() {
    const tbody = document.getElementById('inboxMessagesTableBody');
    const count = document.getElementById('dashInboxCount');

    const list = getVisibleInboxMessages();

    if (count) count.textContent = list.length;

    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted py-4">
            لا توجد رسائل واردة.
          </td>
        </tr>
      `;
      updateDashboardInboxDot();
      return;
    }

    tbody.innerHTML = list.map(function(item) {
      const messageId = item.message_id || '';

      return `
        <tr>
          <td class="small text-muted">${safeHtml(item.created_at || '')}</td>
          <td class="fw-bold">${safeHtml(item.sender_name || 'بدون اسم')}</td>
          <td class="taldo-inbox-message-cell">${safeHtml(item.message_text || '')}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger" onclick="hideTaldoInboxMessage('${safeAttr(messageId)}')">
              إخفاء
            </button>
          </td>
        </tr>
      `;
    }).join('');

    updateDashboardInboxDot();
  }

  window.renderInboxTable = renderInboxTable;

  window.hideTaldoInboxMessage = async function(messageId) {
    if (!messageId) {
      showToast('معرّف الرسالة غير موجود.');
      return;
    }

    try {
      const res = await apiRequest('hideInboxMessage', {
        message_id: messageId
      });

      if (!res || res.success === false) {
        showToast(res?.message || 'تعذر إخفاء الرسالة.');
        return;
      }

      window.__inboxMessages = getInboxMessages().map(function(item) {
        if (item.message_id === messageId) {
          return Object.assign({}, item, {
            status: 'hidden',
            hidden_at: new Date().toISOString(),
            hidden_by: 'admin'
          });
        }

        return item;
      });

      showToast(res.message || 'تم إخفاء الرسالة.');
      renderInboxTable();
      updateDashboardInboxDot();
    } catch (e) {
      showToast(e.message || 'تعذر إخفاء الرسالة.');
    }
  };

  const oldApiRequest =
    window.apiRequest ||
    (typeof apiRequest === 'function' ? apiRequest : null);

  if (typeof oldApiRequest === 'function' && !oldApiRequest.__publicInboxWrapped) {
    window.apiRequest = function(action, data, options) {
      return oldApiRequest.apply(this, arguments).then(function(res) {
        if (action === 'getAdminDashboardData' && res && res.success !== false) {
          window.__inboxMessages = res.inboxMessages || window.__inboxMessages || [];
          setTimeout(function() {
            ensureDashboardInboxTab();
            updateDashboardInboxDot();
          }, 50);
        }

        return res;
      });
    };

    window.apiRequest.__publicInboxWrapped = true;

    try {
      apiRequest = window.apiRequest;
    } catch (e) {}
  }

  const oldRefreshDashboardData =
    window.refreshDashboardData ||
    (typeof refreshDashboardData === 'function' ? refreshDashboardData : null);

  if (typeof oldRefreshDashboardData === 'function' && !oldRefreshDashboardData.__publicInboxWrapped) {
    window.refreshDashboardData = function() {
      const result = oldRefreshDashboardData.apply(this, arguments);

      setTimeout(function() {
        ensureDashboardInboxTab();
        renderInboxTable();
        updateDashboardInboxDot();
      }, 250);

      return result;
    };

    window.refreshDashboardData.__publicInboxWrapped = true;

    try {
      refreshDashboardData = window.refreshDashboardData;
    } catch (e) {}
  }

  const oldShowDashboardTab =
    window.showDashboardTab ||
    (typeof showDashboardTab === 'function' ? showDashboardTab : null);

function deactivateInboxDashboardTab() {
  const inboxPane = document.getElementById('dashboardInboxTab');
  const inboxBtn = document.getElementById('dashInboxTabBtn');

  if (inboxPane) {
    inboxPane.classList.add('d-none');
    inboxPane.classList.remove('active');
  }

  if (inboxBtn) {
    inboxBtn.classList.remove('active');
  }
}

window.showDashboardTab = function(tabName) {
  if (tabName === 'inbox') {
    ensureDashboardInboxTab();

    document.querySelectorAll('.dashboard-tab-pane').forEach(function(pane) {
      pane.classList.add('d-none');
      pane.classList.remove('active');
    });

    document.querySelectorAll('#dashboardPage .nav-link, .dashboard-tabs .nav-link').forEach(function(btn) {
      btn.classList.remove('active');
    });

    document.getElementById('dashboardInboxTab')?.classList.remove('d-none');
    document.getElementById('dashboardInboxTab')?.classList.add('active');
    document.getElementById('dashInboxTabBtn')?.classList.add('active');

    renderInboxTable();
    return;
  }

  /*
    مهم:
    عند فتح أي تبويب آخر، نخفي تبويب صندوق الوارد ونزيل عنه active
    حتى لا يبقى أزرق مع التبويب الجديد.
  */
  deactivateInboxDashboardTab();

  if (typeof oldShowDashboardTab === 'function') {
    const result = oldShowDashboardTab.apply(this, arguments);

    setTimeout(function() {
      deactivateInboxDashboardTab();
      ensureDashboardInboxTab();
      renderInboxTable();
    }, 120);

    return result;
  }
};

  try {
    showDashboardTab = window.showDashboardTab;
  } catch (e) {}

  const oldUpdateAdminButtons =
    window.updateAdminButtons ||
    (typeof updateAdminButtons === 'function' ? updateAdminButtons : null);

  if (typeof oldUpdateAdminButtons === 'function' && !oldUpdateAdminButtons.__publicInboxWrapped) {
    window.updateAdminButtons = function() {
      const result = oldUpdateAdminButtons.apply(this, arguments);

      setTimeout(function() {
        ensureDashboardInboxTab();
        updateDashboardInboxDot();

        if (isAdminMode()) {
          loadInboxBadgeSilently();
        }
      }, 250);

      return result;
    };

    window.updateAdminButtons.__publicInboxWrapped = true;

    try {
      updateAdminButtons = window.updateAdminButtons;
    } catch (e) {}
  }

  function bootPublicInboxFeature() {
    installInboxCss();
    ensureInboxModal();
    ensureThanksModal();
    ensureFloatingButton();
    ensureDashboardInboxTab();
    updateDashboardInboxDot();

    if (isAdminMode()) {
      setTimeout(loadInboxBadgeSilently, 600);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPublicInboxFeature);
  } else {
    bootPublicInboxFeature();
  }

  setTimeout(bootPublicInboxFeature, 900);
})();
