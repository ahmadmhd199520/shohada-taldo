(function() {
  function isYesValue(value) {
    const text = String(value || '').trim().toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
    return ['نعم', 'yes', 'true', '1', 'مفعل', 'active'].includes(text);
  }

  function safeNumber(value, fallback, min, max, decimals) {
    const n = Number(value);
    const base = Number.isNaN(n) ? fallback : n;
    const clamped = Math.max(min, Math.min(max, base));
    const factor = Math.pow(10, decimals || 0);
    return String(Math.round(clamped * factor) / factor);
  }

  function getMartyrOptionsHtml(selectedId) {
    const map = new Map();

    (dashboardData || []).concat(allMartyrs || []).forEach(item => {
      if (!item || !item.martyr_id) return;
      map.set(item.martyr_id, item.full_name || item.martyr_id);
    });

    const options = ['<option value="">رسالة عامة غير مرتبطة بشهيد</option>'];

    Array.from(map.entries())
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'ar'))
      .forEach(([id, name]) => {
        options.push(`<option value="${escapeAttr(id)}" ${id === selectedId ? 'selected' : ''}>${escapeHtml(name)}</option>`);
      });

    return options.join('');
  }

  function ensureDynamicReplyUI() {
    const body = document.querySelector('#dynamicMessageModal .modal-body');
    if (!body || document.getElementById('dynamicReplyBox')) return;

    const oldButton = body.querySelector('button[onclick="acceptDynamicMessage()"]');

    const replyBox = document.createElement('div');
    replyBox.id = 'dynamicReplyBox';
    replyBox.className = 'dynamic-reply-box d-none mt-3';
    replyBox.innerHTML = `
      <div class="small text-muted mb-2" id="dynamicReplyLinkedText"></div>
      <div class="mb-2">
        <label class="form-label fw-bold">ردك على هذه الرسالة</label>
        <textarea class="form-control" id="dynamicReplyText" rows="4" placeholder="اكتب المعلومات المتوفرة لديك هنا..."></textarea>
      </div>
      <div class="mb-2">
        <label class="form-label fw-bold">إرفاق صورة إن وجدت</label>
        <input type="file" class="form-control" id="dynamicReplyImages" accept="image/*" multiple>
      </div>
      <div class="d-flex gap-2 mt-3">
        <button class="btn btn-primary w-50" id="dynamicReplySubmitBtn" onclick="submitDynamicMessageReply()">
          <i class="fa-solid fa-paper-plane ms-1"></i>
          إرسال الرد
        </button>
        <button class="btn btn-outline-secondary w-50" onclick="skipDynamicMessage()">
          تخطي
        </button>
      </div>
    `;

    if (oldButton) {
      oldButton.insertAdjacentElement('beforebegin', replyBox);
      oldButton.id = 'dynamicMessageOkBtn';
    } else {
      body.appendChild(replyBox);
    }
  }

  function canReplyToMessage(msg) {
    return !!msg && (String(msg.message_type || '') === 'question' || isYesValue(msg.allow_reply));
  }

  function rememberDynamicMessageIfChecked() {
  const msg = window.__currentDynamicMessage;
  const checkbox = document.getElementById('dynamicDontShowAgain');

  if (msg && msg.message_id && checkbox && checkbox.checked) {
    localStorage.setItem('taldo_msg_hidden_' + msg.message_id, '1');
  }
}

  window.showDynamicMessage = function(msg, list) {
    ensureDynamicReplyUI();

    window.__currentDynamicMessage = msg;
    window.__dynamicMessageList = list || [];

    document.getElementById('dynamicMessageTitle').textContent = msg.title || 'رسالة';
    document.getElementById('dynamicMessageBody').textContent = msg.body || '';
    document.getElementById('dynamicDontShowAgain').checked = false;

    const imageWrap = document.getElementById('dynamicMessageImageWrap');
    const img = document.getElementById('dynamicMessageImage');
    const src = msg.image_file_id
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(msg.image_file_id)}&sz=w900`
      : (msg.image_url || '');

    if (src) {
      imageWrap.classList.remove('d-none');
      img.src = src;
    } else {
      imageWrap.classList.add('d-none');
      img.removeAttribute('src');
    }

    const replyBox = document.getElementById('dynamicReplyBox');
    const okBtn = document.getElementById('dynamicMessageOkBtn');
    const replyText = document.getElementById('dynamicReplyText');
    const replyImages = document.getElementById('dynamicReplyImages');
    const linkedText = document.getElementById('dynamicReplyLinkedText');

    if (replyText) replyText.value = '';
    if (replyImages) replyImages.value = '';

    if (canReplyToMessage(msg)) {
      replyBox?.classList.remove('d-none');
      if (okBtn) okBtn.classList.add('d-none');

      if (linkedText) {
        linkedText.innerHTML = msg.martyr_id
          ? `<span class="message-linked-badge"><i class="fa-solid fa-link"></i> هذا الرد سيرسل كاستكمال بيانات للشهيد: ${escapeHtml(msg.martyr_name || '')}</span>`
          : `<span class="message-linked-badge"><i class="fa-solid fa-message"></i> هذا الرد عام وسيظهر في لوحة الإعدادات ضمن ردود هذه الرسالة</span>`;
      }
    } else {
      replyBox?.classList.add('d-none');
      if (okBtn) okBtn.classList.remove('d-none');
    }

    modals.dynamicMessageModal.show();
  };

window.skipDynamicMessage = function() {
  rememberDynamicMessageIfChecked();

  modals.dynamicMessageModal.hide();

  const list = window.__dynamicMessageList || [];
  currentDynamicMessageIndex++;
  if (list[currentDynamicMessageIndex]) {
    setTimeout(() => showDynamicMessage(list[currentDynamicMessageIndex], list), 350);
  }
};

window.acceptDynamicMessage = function() {
  rememberDynamicMessageIfChecked();
  skipDynamicMessage();
};

  window.submitDynamicMessageReply = async function() {
    const msg = window.__currentDynamicMessage;
    if (!msg) return;

    const replyText = document.getElementById('dynamicReplyText')?.value.trim() || '';
    const files = document.getElementById('dynamicReplyImages')?.files || [];

    if (!replyText && !files.length) {
      showToast('يرجى كتابة الرد أو رفع صورة.');
      return;
    }

    const btn = document.getElementById('dynamicReplySubmitBtn');
    const oldHtml = btn ? btn.innerHTML : '';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الإرسال...`;
    }

    try {
      const payload = {
        message_id: msg.message_id,
        message_title: msg.title || '',
        martyr_id: msg.martyr_id || '',
        martyr_name: msg.martyr_name || '',
        reply_text: replyText,
        imageFiles: typeof filesToPayload === 'function' ? await filesToPayload(files) : []
      };

      const res = await apiRequest('submitMessageReply', payload);

      if (!res || !res.success) {
        showToast(res?.message || 'تعذر إرسال الرد.');
        return;
      }

      showToast(res.message || 'تم إرسال الرد بنجاح.');
rememberDynamicMessageIfChecked();

modals.dynamicMessageModal.hide();

const list = window.__dynamicMessageList || [];
currentDynamicMessageIndex++;
if (list[currentDynamicMessageIndex]) {
  setTimeout(() => showDynamicMessage(list[currentDynamicMessageIndex], list), 450);
}
    } catch (error) {
      showToast(error.message || 'تعذر إرسال الرد.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml || 'إرسال الرد';
      }
    }
  };

  window.addDashboardSettingsTab = function() {
    const tabs = document.querySelector('.dashboard-tabs');
    if (tabs && !document.getElementById('dashSettingsTabBtn')) {
      tabs.insertAdjacentHTML('beforeend', `
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="dashSettingsTabBtn" type="button" onclick="showDashboardTab('settings')">
            <i class="fa-solid fa-gear ms-1"></i>
            الإعدادات العامة
          </button>
        </li>`);
    }

    const dash = document.getElementById('dashboardPage');
    if (!dash) return;

    if (!document.getElementById('dashboardSettingsTab')) {
      dash.insertAdjacentHTML('beforeend', `<div id="dashboardSettingsTab" class="dashboard-tab-pane d-none"></div>`);
    }

    const settingsTab = document.getElementById('dashboardSettingsTab');
    if (!settingsTab || settingsTab.dataset.replyVersion === '1') return;

    settingsTab.dataset.replyVersion = '1';
    settingsTab.innerHTML = `
      <div class="settings-card">
        <h5 class="fw-bold mb-3"><i class="fa-solid fa-bullhorn text-primary ms-1"></i> رسائل تظهر عند فتح الموقع</h5>

        <div class="alert alert-info">
          يمكن أن تكون الرسالة تنبيهًا عاديًا، أو سؤالًا قابلًا للرد. إذا ربطت السؤال بشهيد محدد فسيصل رد المستخدم إلى تبويب استكمال البيانات مميزًا بأنه من ردود المستخدمين.
        </div>

        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label fw-bold">العنوان</label>
            <input class="form-control" id="msgTitle">
          </div>

          <div class="col-md-2">
            <label class="form-label fw-bold">الترتيب</label>
            <input class="form-control" id="msgOrder" value="100">
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold">الحالة</label>
            <select class="form-select" id="msgStatus">
              <option value="active">مفعل</option>
              <option value="inactive">غير مفعل</option>
            </select>
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold">نوع الرسالة</label>
            <select class="form-select" id="msgType" onchange="handleMessageTypeChange()">
              <option value="notice">رسالة اطلاع فقط</option>
              <option value="question">رسالة يمكن الرد عليها</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label fw-bold">ربط الرسالة بشهيد</label>
            <select class="form-select" id="msgMartyrId">
              ${getMartyrOptionsHtml('')}
            </select>
            <div class="form-text">اتركها رسالة عامة إذا لم تكن مرتبطة بشهيد.</div>
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold">السماح بالرد</label>
            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" id="msgAllowReply">
              <label class="form-check-label" for="msgAllowReply">مفعل</label>
            </div>
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold">صورة مع الرسالة</label>
            <input type="file" class="form-control" id="msgImage" accept="image/*">
          </div>

          <div class="col-12">
            <label class="form-label fw-bold">نص الرسالة</label>
            <textarea class="form-control" id="msgBody" rows="4" placeholder="مثال: هل لديك معلومات عن مواليد الشهيد فلان؟"></textarea>
          </div>

          <div class="col-12">
            <button class="btn btn-primary" onclick="saveDashboardMessage()">
              <i class="fa-solid fa-floppy-disk ms-1"></i>
              حفظ الرسالة
            </button>
          </div>
        </div>

        <hr>
        <div id="messagesAdminList"></div>
      </div>

      <div class="settings-card">
        <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-info text-primary ms-1"></i> نص من نحن</h5>
        <textarea class="form-control" id="aboutUsAdminText" rows="5"></textarea>
        <button class="btn btn-primary mt-3" onclick="saveAboutUsText()">حفظ نص من نحن</button>
      </div>`;
  };

  window.handleMessageTypeChange = function() {
    const type = document.getElementById('msgType')?.value || 'notice';
    const allow = document.getElementById('msgAllowReply');
    if (allow && type === 'question') allow.checked = true;
  };

  window.renderSettingsTab = function() {
    addDashboardSettingsTab();

    const messages = (window.__adminMessages || siteMessages || []);
    const replies = (window.__messageReplies || []);
    const list = document.getElementById('messagesAdminList');
    const about = document.getElementById('aboutUsAdminText');
    const martyrSelect = document.getElementById('msgMartyrId');

    if (about) about.value = publicSettings.about_us_text || '';
    if (martyrSelect) martyrSelect.innerHTML = getMartyrOptionsHtml(martyrSelect.value || '');

    if (!list) return;

    if (!messages.length) {
      list.innerHTML = '<div class="text-muted">لا توجد رسائل مخصصة بعد.</div>';
      return;
    }

    list.innerHTML = messages.map(msg => {
      const msgReplies = replies.filter(r => String(r.message_id || '') === String(msg.message_id || ''));
      const isLinked = !!msg.martyr_id;
      const canViewReplies = !isLinked && canReplyToMessage(msg);

      return `
        <div class="border rounded-4 p-3 mb-2">
          <div class="d-flex justify-content-between gap-2 flex-wrap">
            <div>
              <div class="fw-bold">${escapeHtml(msg.title || '')}</div>
              <div class="small text-muted">
                ${escapeHtml(msg.status || '')} - ترتيب: ${escapeHtml(msg.sort_order || '')}
                - النوع: ${String(msg.message_type || 'notice') === 'question' ? 'قابلة للرد' : 'اطلاع فقط'}
              </div>
              ${isLinked ? `
                <div class="mt-1">
                  <span class="message-linked-badge"><i class="fa-solid fa-link"></i> مرتبطة بالشهيد: ${escapeHtml(msg.martyr_name || msg.martyr_id || '')}</span>
                </div>
              ` : canReplyToMessage(msg) ? `
                <div class="mt-1">
                  <span class="message-linked-badge"><i class="fa-solid fa-message"></i> رسالة عامة قابلة للرد</span>
                </div>
              ` : ''}
            </div>
            <div class="d-flex gap-1 flex-wrap">
              ${canViewReplies ? `
                <button class="btn btn-sm btn-outline-success" onclick="toggleMessageReplies('${escapeAttr(msg.message_id)}')">
                  عرض الردود (${msgReplies.length})
                </button>
              ` : ''}
              <button class="btn btn-sm btn-outline-primary" onclick="toggleDashboardMessage('${escapeAttr(msg.message_id)}','${msg.status === 'active' ? 'inactive' : 'active'}')">
                ${msg.status === 'active' ? 'إلغاء التفعيل' : 'تفعيل'}
              </button>
            </div>
          </div>

          <div class="mt-2" style="white-space:pre-line">${escapeHtml(msg.body || '')}</div>

          <div id="messageReplies_${escapeAttr(msg.message_id)}" class="d-none mt-3">
            ${renderMessageRepliesHtml(msg.message_id)}
          </div>
        </div>`;
    }).join('');
  };

  window.renderMessageRepliesHtml = function(messageId) {
    const replies = (window.__messageReplies || []).filter(r => r.message_id === messageId);

    if (!replies.length) {
      return `<div class="text-muted small">لا توجد ردود على هذه الرسالة بعد.</div>`;
    }

    return replies.map(reply => {
      const img = reply.image_file_id
        ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(reply.image_file_id)}&sz=w700`
        : (reply.image_url || '');

      return `
        <div class="message-reply-card">
          <div class="d-flex justify-content-between gap-2 flex-wrap">
            <div class="fw-bold small">${escapeHtml(reply.created_at || '')}</div>
            <span class="badge text-bg-warning">${escapeHtml(reply.status || 'بانتظار المراجعة')}</span>
          </div>
          <div class="mt-2" style="white-space:pre-line">${escapeHtml(reply.reply_text || '')}</div>
          ${img ? `<a href="${escapeAttr(img)}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">عرض الصورة</a>` : ''}
        </div>`;
    }).join('');
  };

  window.toggleMessageReplies = function(messageId) {
    const box = document.getElementById('messageReplies_' + messageId);
    if (!box) return;

    box.innerHTML = renderMessageRepliesHtml(messageId);
    box.classList.toggle('d-none');
  };

  window.saveDashboardMessage = function() {
    const file = document.getElementById('msgImage')?.files?.[0];
    const martyrSelect = document.getElementById('msgMartyrId');
    const martyrId = martyrSelect?.value || '';
    const martyrName = martyrId ? (martyrSelect.options[martyrSelect.selectedIndex]?.text || '') : '';

    const payload = {
      title: document.getElementById('msgTitle')?.value || '',
      body: document.getElementById('msgBody')?.value || '',
      status: document.getElementById('msgStatus')?.value || 'active',
      sort_order: document.getElementById('msgOrder')?.value || '100',
      message_type: document.getElementById('msgType')?.value || 'notice',
      allow_reply: document.getElementById('msgAllowReply')?.checked ? 'نعم' : 'لا',
      martyr_id: martyrId,
      martyr_name: martyrName
    };

    const finish = () => apiRequest('saveSiteMessage', payload).then(res => {
      showToast(res.message || 'تم حفظ الرسالة.');

      ['msgTitle', 'msgBody'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      const msgOrder = document.getElementById('msgOrder');
      if (msgOrder) msgOrder.value = '100';

      const msgImage = document.getElementById('msgImage');
      if (msgImage) msgImage.value = '';

      const msgType = document.getElementById('msgType');
      if (msgType) msgType.value = 'notice';

      const msgAllow = document.getElementById('msgAllowReply');
      if (msgAllow) msgAllow.checked = false;

      const msgMartyr = document.getElementById('msgMartyrId');
      if (msgMartyr) msgMartyr.value = '';

      refreshDashboardData(false);
      loadInitialData();
    }).catch(err => showToast(err.message || 'تعذر الحفظ.'));

    if (file) {
      fileToBase64(file).then(base64 => {
        payload.imageBase64 = base64;
        payload.imageName = file.name;
        finish();
      });
    } else {
      finish();
    }
  };

  const previousRefreshDashboardDataForReplies = window.refreshDashboardData;
  window.refreshDashboardData = function(showMsg = true) {
    if (!isAdminLoggedIn) {
      showToast('يرجى تسجيل الدخول أولًا.');
      return;
    }

    apiRequest('getAdminDashboardData')
      .then(res => {
        if (!res || !res.success) {
          showToast('تعذر تحميل بيانات لوحة التحكم.');
          return;
        }

        statsData = res.stats || statsData;
        dashboardData = res.all || [];
        dataUpdateRequests = res.dataUpdates || [];
        joinRequests = res.joinRequests || [];
        window.__adminMessages = res.messages || [];
        window.__messageReplies = res.messageReplies || [];
        publicSettings = res.settings || publicSettings || {};

        updateStatsCards();
        updateDashboardStats();
        renderDashboardTable();
        renderDataUpdateRequestsTable();
        renderJoinRequestsTable();
        renderSettingsTab();

        if (showMsg) showToast('تم تحديث لوحة التحكم.');
      })
      .catch(err => {
        showToast(err.message || 'حدث خطأ أثناء تحميل لوحة التحكم.');
      });
  };

  window.renderDataUpdateRequestsTable = function() {
    const tbody = document.getElementById('dataUpdatesTableBody');
    const countBadge = document.getElementById('dataUpdatesCount');

    if (!tbody) return;

    const search = normalizeText(document.getElementById('dataUpdatesSearchInput')?.value || '');
    const statusFilter = document.getElementById('dataUpdatesStatusFilter')?.value ?? 'بانتظار المراجعة';
    const sortBy = document.getElementById('dataUpdatesSortSelect')?.value || 'newest';

    let list = (dataUpdateRequests || []).slice();

    if (statusFilter) {
      list = list.filter(item => String(item.status || '').trim() === statusFilter);
    } else {
      list = list.filter(item => String(item.status || '').trim() !== '');
    }

    if (search) {
      list = list.filter(item => {
        const content = normalizeText([
          item.created_at,
          item.martyr_name,
          item.family_name,
          item.submitted_text,
          item.request_text,
          item.status,
          item.source_type === 'message_reply' ? 'من ردود المستخدمين' : ''
        ].join(' '));

        return content.includes(search);
      });
    }

    if (sortBy === 'oldest') {
      list.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    } else if (sortBy === 'name') {
      list.sort((a, b) => String(a.martyr_name || '').localeCompare(String(b.martyr_name || ''), 'ar'));
    } else {
      list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }

    if (countBadge) countBadge.textContent = list.length;

    if (!list.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            لا توجد طلبات مطابقة للبحث أو الفلترة الحالية.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => {
      const requestId = item.update_id || item.request_id || '';
      const requestText = item.submitted_text || item.request_text || '';
      const isFromUserReply = String(item.source_type || '') === 'message_reply';
      const img = item.image_file_id
        ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.image_file_id)}&sz=w500`
        : '';

      return `
        <tr>
          <td>${escapeHtml(item.created_at || '')}</td>
          <td class="fw-bold" style="cursor:pointer;color:#0d6efd;" onclick="openMartyrDetails('${escapeAttr(item.martyr_id)}', 'dashboardDataUpdatesTab')">${escapeHtml(item.martyr_name || '')}</td>
          <td>${escapeHtml(item.family_name || '')}</td>
          <td class="request-text-cell">
            ${isFromUserReply ? `<div class="user-reply-source-badge"><i class="fa-solid fa-reply"></i> من ردود المستخدمين</div>` : ''}
            <div>${escapeHtml(requestText)}</div>
            ${img ? `<a href="${escapeAttr(img)}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">عرض الصورة</a>` : ''}
          </td>
          <td>${statusBadge(item.status)}</td>
          <td>
            ${isPendingRequest(item.status) ? `
              <div class="d-flex gap-1 flex-wrap">
                <button class="btn btn-sm btn-success" onclick="approveDataUpdateFromDashboard('${escapeAttr(requestId)}')">قبول وإضافة</button>
                <button class="btn btn-sm btn-outline-danger" onclick="rejectDataUpdateFromDashboard('${escapeAttr(requestId)}')">رفض</button>
              </div>` : '-'}
          </td>
        </tr>`;
    }).join('');
  };

  function getPositionValueFinal(target, mode, axis) {
    const key = axis === 'x' ? 'x' : 'y';
    const source = target || {};
    const current = (mode === 'detail') ? (window.currentDetailsItem || currentDetailsItem || {}) : {};

    const cardKey = key === 'x' ? 'card_position_x' : 'card_position_y';
    const detailKey = key === 'x' ? 'detail_position_x' : 'detail_position_y';
    const oldPositionKey = key === 'x' ? 'position_x' : 'position_y';
    const oldMainKey = key === 'x' ? 'image_position_x' : 'image_position_y';

    if (mode === 'card') {
      return safeNumber(source[cardKey] || source[oldMainKey] || '50', 50, 0, 100, 0);
    }

    return safeNumber(
      source[detailKey] ||
      current[detailKey] ||
      source[oldPositionKey] ||
      current[oldPositionKey] ||
      source[oldMainKey] ||
      current[oldMainKey] ||
      '50',
      50,
      0,
      100,
      0
    );
  }

  function getZoomValueFinal(target, mode) {
    const source = target || {};
    const current = (mode === 'detail') ? (window.currentDetailsItem || currentDetailsItem || {}) : {};

    if (mode === 'card') {
      return safeNumber(source.card_zoom || current.card_zoom || '1', 1, 1, 3, 2);
    }

    return safeNumber(source.detail_zoom || current.detail_zoom || source.card_zoom || current.card_zoom || '1', 1, 1, 3, 2);
  }

  function getImageStyleFinal(target, mode) {
    const x = getPositionValueFinal(target, mode, 'x');
    const y = getPositionValueFinal(target, mode, 'y');
    const zoom = getZoomValueFinal(target, mode);

    return `object-position:${x}% ${y}%;transform:scale(${zoom});transform-origin:${x}% ${y}%;`;
  }

  function normalizeImagesWithZoom(item) {
    const images = [];

    if (Array.isArray(item?.images)) {
      item.images.forEach(img => {
        const src = img.image_file_id
          ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(img.image_file_id)}&sz=w1000`
          : (img.image_url || '');

        if (src) {
          images.push({
            src,
            image_id: img.image_id || '',
            image_file_id: img.image_file_id || '',
            image_url: img.image_url || '',
            is_primary: img.is_primary || '',
            source_type: img.source_type || '',
            position_x: img.position_x || '50',
            position_y: img.position_y || '50',
            card_position_x: img.card_position_x || item?.card_position_x || item?.image_position_x || '50',
            card_position_y: img.card_position_y || item?.card_position_y || item?.image_position_y || '50',
            detail_position_x: img.detail_position_x || img.position_x || item?.detail_position_x || item?.image_position_x || '50',
            detail_position_y: img.detail_position_y || img.position_y || item?.detail_position_y || item?.image_position_y || '50',
            card_zoom: img.card_zoom || item?.card_zoom || '1',
            detail_zoom: img.detail_zoom || item?.detail_zoom || '1'
          });
        }
      });
    }

    const main = getImageSrc(item);

    if (main && !images.some(img => img.src === main)) {
      images.unshift({
        src: main,
        image_id: '',
        image_file_id: item?.image_file_id || extractDriveFileId(item?.image_url || ''),
        image_url: item?.image_url || '',
        position_x: item?.image_position_x || '50',
        position_y: item?.image_position_y || '50',
        card_position_x: item?.card_position_x || item?.image_position_x || '50',
        card_position_y: item?.card_position_y || item?.image_position_y || '50',
        detail_position_x: item?.detail_position_x || item?.image_position_x || '50',
        detail_position_y: item?.detail_position_y || item?.image_position_y || '50',
        card_zoom: item?.card_zoom || '1',
        detail_zoom: item?.detail_zoom || '1'
      });
    }

    return images;
  }

  window.normalizeImages = normalizeImagesWithZoom;

  function getPrimaryPositionTargetFinal(item) {
    const images = normalizeImagesWithZoom(item || {});
    const main = getImageSrc(item);
    return images.find(img => img.src === main || img.image_file_id === item?.image_file_id) || item || {};
  }

  window.renderMartyrCard = function(item) {
    const verified = item.verification_status === 'موثق';
    const pending = item.verification_status === 'بانتظار التوثيق';
    const needsCompletion = isNeedsCompletion(item);
    const img = getImageSrc(item);
    const clickAction = pending && !isAdminLoggedIn
      ? 'showPendingInfo()'
      : `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`;

    const targetImage = getPrimaryPositionTargetFinal(item);
    const positionStyle = getImageStyleFinal(targetImage, 'card');

    return `
      <div class="martyr-card ${pending ? 'pending-card' : ''}" onclick="${clickAction}">
        ${pending ? `<div class="pending-corner">قيد التدقيق</div>` : needsCompletion ? `
          <div class="needs-completion-corner">يحتاج استكمال</div>
        ` : verified ? `<div class="verified-corner"><i class="fa-solid fa-check"></i></div>` : ''}
        <div class="martyr-image-wrap">
          ${img ? `
            <img src="${escapeAttr(img)}" class="martyr-image" style="${positionStyle}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
            <div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>
          ` : `<div class="martyr-placeholder"><i class="fa-solid fa-user"></i></div>`}
        </div>
        <div class="martyr-body">
          <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
          <div class="martyr-family">عائلة ${escapeHtml(item.family_name || '')}</div>
          ${pending ? `<span class="badge text-bg-secondary mt-2">قيد التدقيق</span>` : needsCompletion ? `
            <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
          ` : verified ? `<span class="badge badge-soft-blue mt-2">موثق</span>` : ''}
        </div>
      </div>`;
  };

  window.renderMartyrCardForFamily = function(item) {
    return renderMartyrCard(item).replace(
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`,
      `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'familyMartyrsPage')`
    );
  };

  function ensureImagePositionTabsAndZoom() {
    const modal = document.getElementById('imagePositionModal');
    if (!modal) return;

    const alert = modal.querySelector('.modal-body .alert');
    if (alert) {
      alert.innerHTML = 'هذا الضبط لا يقص الصورة الأصلية، بل يحدد الجزء والحجم الذي يظهر داخل الصورة. يمكنك ضبط عرض الصورة في الصفحة الرئيسية بشكل مستقل عن عرضها في الملف الشخصي للشهيد.';

      if (!document.getElementById('imagePositionMode')) {
        alert.insertAdjacentHTML('afterend', `
          <input type="hidden" id="imagePositionMode" value="card">
          <ul class="nav nav-pills image-position-tabs mb-3" role="tablist">
            <li class="nav-item" role="presentation">
              <button type="button" class="nav-link active" id="imagePositionTabCard" onclick="switchImagePositionMode('card')">
                <i class="fa-solid fa-table-cells-large ms-1"></i>
                الصورة في الصفحة الرئيسية
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button type="button" class="nav-link" id="imagePositionTabDetail" onclick="switchImagePositionMode('detail')">
                <i class="fa-solid fa-id-card ms-1"></i>
                الصورة في الملف الشخصي للشهيد
              </button>
            </li>
          </ul>
        `);
      }
    }

    const row = modal.querySelector('.modal-body .row.g-3');
    if (row && !document.getElementById('imagePositionZoom')) {
      row.insertAdjacentHTML('beforeend', `
        <div class="col-12">
          <label class="form-label fw-bold">تكبير / تصغير الصورة</label>
          <input type="range" class="form-range" id="imagePositionZoom" min="1" max="3" step="0.05" value="1" oninput="updateImagePositionPreview()">
          <div class="d-flex justify-content-between image-zoom-preview-note">
            <span>الحجم الطبيعي</span>
            <span id="imagePositionZoomValue">1.00x</span>
            <span>تكبير</span>
          </div>
        </div>
      `);
    }
  }

  function storeActivePositionInDraftFinal() {
    const draft = window.__imagePositionDraft;
    if (!draft) return;

    const mode = document.getElementById('imagePositionMode')?.value || 'card';

    draft[mode] = {
      x: document.getElementById('imagePositionX')?.value || draft[mode]?.x || '50',
      y: document.getElementById('imagePositionY')?.value || draft[mode]?.y || '50',
      zoom: document.getElementById('imagePositionZoom')?.value || draft[mode]?.zoom || '1'
    };
  }

  window.switchImagePositionMode = function(mode) {
    ensureImagePositionTabsAndZoom();
    storeActivePositionInDraftFinal();

    mode = mode === 'detail' ? 'detail' : 'card';
    const draft = window.__imagePositionDraft || {
      card: { x: '50', y: '50', zoom: '1' },
      detail: { x: '50', y: '50', zoom: '1' }
    };

    document.getElementById('imagePositionMode').value = mode;
    document.getElementById('imagePositionTabCard')?.classList.toggle('active', mode === 'card');
    document.getElementById('imagePositionTabDetail')?.classList.toggle('active', mode === 'detail');

    const previewWrap = document.querySelector('#imagePositionModal .image-position-preview-wrap');
    if (previewWrap) {
      previewWrap.classList.toggle('image-position-card-preview', mode === 'card');
      previewWrap.classList.toggle('image-position-detail-preview', mode === 'detail');
    }

    document.getElementById('imagePositionX').value = draft[mode]?.x || '50';
    document.getElementById('imagePositionY').value = draft[mode]?.y || '50';
    document.getElementById('imagePositionZoom').value = draft[mode]?.zoom || '1';

    updateImagePositionPreview();
  };

  window.updateImagePositionPreview = function() {
    const preview = document.getElementById('imagePositionPreview');
    if (!preview) return;

    const x = document.getElementById('imagePositionX')?.value || '50';
    const y = document.getElementById('imagePositionY')?.value || '50';
    const zoom = safeNumber(document.getElementById('imagePositionZoom')?.value || '1', 1, 1, 3, 2);

    preview.style.objectPosition = `${x}% ${y}%`;
    preview.style.transform = `scale(${zoom})`;
    preview.style.transformOrigin = `${x}% ${y}%`;

    const zoomValue = document.getElementById('imagePositionZoomValue');
    if (zoomValue) zoomValue.textContent = `${Number(zoom).toFixed(2)}x`;

    storeActivePositionInDraftFinal();
  };

  window.renderImageGallery = function(item) {
    const images = normalizeImagesWithZoom(item);

    if (!images.length) {
      return `<div class="detail-image-placeholder"><div><i class="fa-solid fa-user fa-4x text-secondary mb-3"></i><div>لا توجد صورة مرفقة</div></div></div>`;
    }

    if (currentGalleryIndex >= images.length) currentGalleryIndex = 0;
    const first = images[currentGalleryIndex] || images[0];
    const style = getImageStyleFinal(first, 'detail');

    return `
      <div class="image-gallery">
        <img id="galleryMainImage" src="${escapeAttr(first.src)}" class="gallery-main-image detail-image" style="${style}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
        <div class="detail-image-placeholder" style="display:none;"><div>تعذر عرض الصورة</div></div>

        ${isAdminLoggedIn ? `
          <button class="btn btn-light image-position-btn" title="ضبط موضع وحجم ظهور الصورة" onclick="openImagePositionModal(${currentGalleryIndex})">
            <i class="fa-solid fa-crop-simple text-primary"></i>
          </button>
        ` : ''}

        ${images.length > 1 ? `
          <div class="gallery-controls mt-2 d-flex justify-content-center align-items-center gap-2">
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(-1)">السابق</button>
            <span class="badge text-bg-light align-self-center" id="galleryCounter">${currentGalleryIndex + 1} / ${images.length}</span>
            <button class="btn btn-outline-primary btn-sm" onclick="changeGalleryImage(1)">التالي</button>
          </div>
        ` : ''}

        ${isAdminLoggedIn ? `
          <div class="gallery-admin-tools">
            <div class="small text-muted fw-bold mb-2"><i class="fa-solid fa-user-shield ms-1"></i> إدارة صور الشهيد</div>
            <div class="gallery-thumb-row">
              ${images.map((img, index) => `
                <div class="gallery-thumb-item">
                  <img src="${escapeAttr(img.src)}" alt="" onclick="setGalleryImageIndex(${index})" style="${getImageStyleFinal(img, 'detail')} ${index === currentGalleryIndex ? 'border-color:#0d6efd;' : ''}">
                  <button class="btn btn-danger gallery-delete-btn" title="حذف الصورة" onclick="deleteMartyrImageFromDetails(${index})"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  };

  window.setGalleryImageIndex = function(index) {
    const images = normalizeImagesWithZoom(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = Math.max(0, Math.min(index, images.length - 1));

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.changeGalleryImage = function(step) {
    const images = normalizeImagesWithZoom(currentDetailsItem || {});
    if (!images.length) return;

    currentGalleryIndex = (currentGalleryIndex + step + images.length) % images.length;

    const holder = document.querySelector('#detailsContainer .col-lg-5');
    if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem || {});
  };

  window.openImagePositionModal = function(index) {
    if (!isAdminLoggedIn || !currentDetailsItem) return;

    ensureImagePositionTabsAndZoom();

    const images = normalizeImagesWithZoom(currentDetailsItem);
    const img = images[index] || images[0];
    if (!img) return;

    document.getElementById('imagePositionIndex').value = String(index || 0);
    document.getElementById('imagePositionImageId').value = img.image_id || '';
    document.getElementById('imagePositionFileId').value = img.image_file_id || '';
    document.getElementById('imagePositionPreview').src = img.src;

    window.__imagePositionDraft = {
      card: {
        x: getPositionValueFinal(img, 'card', 'x'),
        y: getPositionValueFinal(img, 'card', 'y'),
        zoom: getZoomValueFinal(img, 'card')
      },
      detail: {
        x: getPositionValueFinal(img, 'detail', 'x'),
        y: getPositionValueFinal(img, 'detail', 'y'),
        zoom: getZoomValueFinal(img, 'detail')
      }
    };

    switchImagePositionMode('card');
    modals.imagePositionModal.show();
  };

  function updateLocalImagePositionsAndZoom(index, imageId, imageFileId, cardPositionX, cardPositionY, detailPositionX, detailPositionY, cardZoom, detailZoom) {
    if (!currentDetailsItem) return;

    if (Array.isArray(currentDetailsItem.images)) {
      currentDetailsItem.images = currentDetailsItem.images.map((old, oldIndex) => {
        const sameId = imageId && old.image_id === imageId;
        const sameFile = imageFileId && old.image_file_id === imageFileId;
        const sameIndex = !imageId && !imageFileId && oldIndex === index;

        return (sameId || sameFile || sameIndex)
          ? Object.assign({}, old, {
              card_position_x: cardPositionX,
              card_position_y: cardPositionY,
              detail_position_x: detailPositionX,
              detail_position_y: detailPositionY,
              position_x: detailPositionX,
              position_y: detailPositionY,
              card_zoom: cardZoom,
              detail_zoom: detailZoom
            })
          : old;
      });
    }

    if (!imageFileId || currentDetailsItem.image_file_id === imageFileId) {
      currentDetailsItem.card_position_x = cardPositionX;
      currentDetailsItem.card_position_y = cardPositionY;
      currentDetailsItem.detail_position_x = detailPositionX;
      currentDetailsItem.detail_position_y = detailPositionY;
      currentDetailsItem.image_position_x = detailPositionX;
      currentDetailsItem.image_position_y = detailPositionY;
      currentDetailsItem.card_zoom = cardZoom;
      currentDetailsItem.detail_zoom = detailZoom;
    }
  }

  window.saveImagePositionFromModal = function() {
    if (!currentDetailsItem) return;

    storeActivePositionInDraftFinal();

    const btn = document.getElementById('imagePositionSaveBtn');
    const index = Number(document.getElementById('imagePositionIndex')?.value || 0);
    const imageId = document.getElementById('imagePositionImageId')?.value || '';
    const imageFileId = document.getElementById('imagePositionFileId')?.value || '';
    const draft = window.__imagePositionDraft || {
      card: { x: '50', y: '50', zoom: '1' },
      detail: { x: '50', y: '50', zoom: '1' }
    };

    const cardPositionX = draft.card?.x || '50';
    const cardPositionY = draft.card?.y || '50';
    const detailPositionX = draft.detail?.x || '50';
    const detailPositionY = draft.detail?.y || '50';
    const cardZoom = draft.card?.zoom || '1';
    const detailZoom = draft.detail?.zoom || '1';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;
    }

    const request = apiRequest('updateMartyrImagePosition', {
      martyrId: currentDetailsItem.martyr_id,
      imageId,
      imageFileId,
      positionX: detailPositionX,
      positionY: detailPositionY,
      cardPositionX,
      cardPositionY,
      detailPositionX,
      detailPositionY,
      cardZoom,
      detailZoom
    }).then(res => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'حفظ موضع الصورة';
      }

      if (!res || !res.success) return showToast(res?.message || 'تعذر حفظ موضع وحجم الصورة.');

      updateLocalImagePositionsAndZoom(index, imageId, imageFileId, cardPositionX, cardPositionY, detailPositionX, detailPositionY, cardZoom, detailZoom);

      modals.imagePositionModal.hide();

      const holder = document.querySelector('#detailsContainer .col-lg-5');
      if (holder) holder.innerHTML = renderImageGallery(currentDetailsItem);

      renderMartyrs();
      showToast(res.message || 'تم ضبط موضع وحجم ظهور الصورة.');

      setTimeout(() => {
        loadInitialData();
        if (isAdminLoggedIn) refreshDashboardData(false);
      }, 100);
    }).catch(err => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'حفظ موضع الصورة';
      }
      showToast(err.message || 'تعذر حفظ موضع وحجم الصورة.');
    });

    if (typeof runWithoutScrollJump === 'function') {
      return runWithoutScrollJump(() => request);
    }

    return request;
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureDynamicReplyUI();
    addDashboardSettingsTab();
    ensureImagePositionTabsAndZoom();
  });
})();
