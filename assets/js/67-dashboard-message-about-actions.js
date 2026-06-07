(function () {
  'use strict';

  const DELETED_STATUS = 'deleted';
  const REQUEST_TIMEOUT_MS = 22000;
  const ADMIN_DASHBOARD_CACHE_KEY = 'taldo_admin_dashboard_cache_v2';


function readMultilineValue(el) {
  return String(el?.value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+$/gm, '');
}
  function clean(value) {
    return String(value || '').trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }


  function readAboutSectionsPreservingMultiline() {
    const rows = Array.from(document.querySelectorAll('.taldo-about-section-admin-item'));

    return rows
      .map(row => {
        const titleEl = row.querySelector('.taldo-about-section-title');
        const bodyEl = row.querySelector('.taldo-about-section-body');

        return {
          title: clean(titleEl?.value || ''),
          body: readMultilineValue(bodyEl).trim()
        };
      })
      .filter(section => section.title || section.body)
      .map(section => ({
        title: section.title || 'قسم بدون عنوان',
        body: section.body || ''
      }));
  }

  function stringifyAboutSectionsPreservingMultiline(sections) {
    return JSON.stringify({
      type: 'about_sections_v1',
      sections: Array.isArray(sections) ? sections : []
    });
  }

  function setAboutValueEverywhere(value) {
    window.__taldoAboutRawValue = value;

    if (!window.publicSettings) window.publicSettings = {};
    window.publicSettings.about_us_text = value;

    try {
      if (typeof publicSettings !== 'undefined' && publicSettings) {
        publicSettings.about_us_text = value;
      }
    } catch (error) {}

    const hidden = document.getElementById('aboutUsAdminText');
    if (hidden) hidden.value = value;

    try {
      localStorage.setItem('taldo_about_us_text_cache', value);
    } catch (error) {}
  }

  function addMessagesFromList(target, list) {
    if (!Array.isArray(list)) return;

    list.forEach(msg => {
      if (!msg) return;
      const id = clean(msg.message_id || msg.messageId || '');
      const title = clean(msg.title || msg.message_title || '');
      if (!id && !title) return;
      target.push(msg);
    });
  }

  function readCachedDashboardPayload() {
    try {
      const raw = sessionStorage.getItem(ADMIN_DASHBOARD_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (parsed && parsed.value && typeof parsed.value === 'object') {
        return parsed.value;
      }

      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function hydrateAdminMessagesFromKnownSources() {
    const found = [];

    addMessagesFromList(found, window.__adminMessages);
    addMessagesFromList(found, window.adminMessages);

    if (window.dashboardData && typeof window.dashboardData === 'object' && !Array.isArray(window.dashboardData)) {
      addMessagesFromList(found, window.dashboardData.messages);
      addMessagesFromList(found, window.dashboardData.siteMessages);
      addMessagesFromList(found, window.dashboardData.site_messages);
    }

    if (window.adminDashboardData && typeof window.adminDashboardData === 'object' && !Array.isArray(window.adminDashboardData)) {
      addMessagesFromList(found, window.adminDashboardData.messages);
      addMessagesFromList(found, window.adminDashboardData.siteMessages);
      addMessagesFromList(found, window.adminDashboardData.site_messages);
    }

    const cached = readCachedDashboardPayload();
    if (cached && typeof cached === 'object') {
      addMessagesFromList(found, cached.messages);
      addMessagesFromList(found, cached.siteMessages);
      addMessagesFromList(found, cached.site_messages);

      if (!Array.isArray(window.__messageReplies) && Array.isArray(cached.messageReplies)) {
        window.__messageReplies = cached.messageReplies;
      }
    }

    if (!found.length) return false;

    const seen = new Set();
    const unique = found.filter(msg => {
      const key = clean(msg.message_id || msg.messageId || msg.title || msg.message_title || '');
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    window.__adminMessages = unique;
    return true;
  }

  function getAdminMessagesList() {
    /*
      لا نستخدم siteMessages هنا لأنها رسائل العرض العام وقد تحتوي المفعّل فقط.
      نحاول أولًا تجميع رسائل لوحة التحكم من الذاكرة أو من كاش الداشبورد المحلي.
      ولا نطلق طلب API جديد من هنا حتى لا تتكرر إعادة الرسم ولا يطول فتح صفحة الإعدادات.
    */
    hydrateAdminMessagesFromKnownSources();

    if (Array.isArray(window.__adminMessages)) {
      return window.__adminMessages;
    }

    return [];
  }

  function ensureFullAdminMessagesLoaded() {
    return Promise.resolve(hydrateAdminMessagesFromKnownSources());
  }

  function getMessageById(messageId) {
    messageId = clean(messageId);
    return getAdminMessagesList().find(msg => clean(msg.message_id) === messageId) || null;
  }

  function withTimeout(promise, ms, message) {
    let timer = null;

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(message || 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى.'));
      }, ms || REQUEST_TIMEOUT_MS);
    });

    return Promise.race([Promise.resolve(promise), timeoutPromise])
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  }

  function setButtonLoading(button, loading, loadingText) {
    if (!button) return;

    if (loading) {
      if (button.dataset.taldoLoading === '1') return;

      button.dataset.taldoLoading = '1';
      button.dataset.taldoOriginalHtml = button.innerHTML;
      button.dataset.taldoOriginalDisabled = button.disabled ? '1' : '0';
      button.disabled = true;
      button.classList.add('taldo-btn-loading');
      button.innerHTML = `
        <span class="spinner-border spinner-border-sm ms-1" aria-hidden="true"></span>
        ${escapeHtml(loadingText || 'جاري التنفيذ...')}
      `;
      return;
    }

    if (button.dataset.taldoLoading !== '1') return;

    button.innerHTML = button.dataset.taldoOriginalHtml || button.innerHTML;
    button.disabled = button.dataset.taldoOriginalDisabled === '1';
    button.classList.remove('taldo-btn-loading');
    delete button.dataset.taldoLoading;
    delete button.dataset.taldoOriginalHtml;
    delete button.dataset.taldoOriginalDisabled;
  }

  function buttonByOnclickPart(part) {
    return Array.from(document.querySelectorAll('button[onclick]'))
      .find(btn => String(btn.getAttribute('onclick') || '').includes(part)) || null;
  }

  function findMessageSaveButton() {
    return buttonByOnclickPart('saveDashboardMessage');
  }

  function findAboutSaveButton() {
    return buttonByOnclickPart('saveAboutUsText');
  }

  function findMessageCard(messageId) {
    messageId = clean(messageId);
    const list = document.getElementById('messagesAdminList');
    if (!list || !messageId) return null;

    const buttons = Array.from(list.querySelectorAll('button[onclick]'));
    const relatedButton = buttons.find(btn => String(btn.getAttribute('onclick') || '').includes(messageId));

    if (!relatedButton) return null;
    return relatedButton.closest('.border.rounded-4, .message-admin-item, .card') || relatedButton.closest('.mb-2');
  }

  function findMessageActionButton(messageId, keyword) {
    const card = findMessageCard(messageId);
    if (!card) return null;

    return Array.from(card.querySelectorAll('button')).find(btn => {
      return String(btn.textContent || '').includes(keyword || '');
    }) || null;
  }

  function ensureMessageEditHiddenField() {
    if (document.getElementById('msgMessageId')) return document.getElementById('msgMessageId');

    const title = document.getElementById('msgTitle');
    if (!title) return null;

    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = 'msgMessageId';
    hidden.value = '';

    title.insertAdjacentElement('beforebegin', hidden);
    return hidden;
  }

  function updateMessageSaveButtonLabel() {
    const button = findMessageSaveButton();
    const hidden = ensureMessageEditHiddenField();
    if (!button || !hidden || button.dataset.taldoLoading === '1') return;

    if (clean(hidden.value)) {
      button.classList.add('taldo-editing-message-save-btn');
      button.innerHTML = `
        <i class="fa-solid fa-floppy-disk ms-1"></i>
        حفظ تعديل الرسالة
      `;
    } else {
      button.classList.remove('taldo-editing-message-save-btn');
      button.innerHTML = `
        <i class="fa-solid fa-floppy-disk ms-1"></i>
        حفظ الرسالة
      `;
    }
  }

  function clearMessageFormAfterSave() {
    const hidden = ensureMessageEditHiddenField();
    if (hidden) hidden.value = '';

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

    const msgStatus = document.getElementById('msgStatus');
    if (msgStatus) msgStatus.value = 'active';

    const msgAllow = document.getElementById('msgAllowReply');
    if (msgAllow) msgAllow.checked = false;

    const msgMartyr = document.getElementById('msgMartyrId');
    if (msgMartyr) msgMartyr.value = '';

    updateMessageSaveButtonLabel();
  }

  function refreshDashboardQuietly() {
    try {
      if (typeof refreshDashboardData === 'function') {
        refreshDashboardData(false);
      }
    } catch (error) {}

    try {
      if (typeof loadInitialData === 'function') {
        setTimeout(() => loadInitialData(), 250);
      }
    } catch (error) {}
  }

  function updateLocalMessageStatus(messageId, status) {
    const lists = [];

    if (Array.isArray(window.__adminMessages)) lists.push(window.__adminMessages);

    try {
      if (Array.isArray(siteMessages)) lists.push(siteMessages);
    } catch (error) {}

    lists.forEach(list => {
      list.forEach(msg => {
        if (clean(msg.message_id) === clean(messageId)) {
          msg.status = status;
        }
      });
    });
  }

  function removeDeletedMessagesFromLocalList(messageId) {
    messageId = clean(messageId);

    if (Array.isArray(window.__adminMessages)) {
      window.__adminMessages = window.__adminMessages.filter(msg => clean(msg.message_id) !== messageId);
    }

    try {
      if (Array.isArray(siteMessages)) {
        siteMessages = siteMessages.filter(msg => clean(msg.message_id) !== messageId);
      }
    } catch (error) {}
  }

  function fillMessageFormForEdit(message) {
    if (!message) return;

    const hidden = ensureMessageEditHiddenField();
    if (hidden) hidden.value = clean(message.message_id);

    const fields = {
      msgTitle: message.title || '',
      msgBody: message.body || '',
      msgStatus: message.status || 'active',
      msgOrder: message.sort_order || '100',
      msgType: message.message_type || 'notice',
      msgMartyrId: message.martyr_id || ''
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    const allow = document.getElementById('msgAllowReply');
    if (allow) {
      allow.checked = String(message.allow_reply || '').trim() === 'نعم' || String(message.message_type || '') === 'question';
    }

    const image = document.getElementById('msgImage');
    if (image) image.value = '';

    updateMessageSaveButtonLabel();

    const title = document.getElementById('msgTitle');
    const card = title ? title.closest('.settings-card') : null;
    const collapse = card ? card.closest('.collapse') : null;

    if (collapse && typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
      bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).show();
    }

    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      if (title) title.focus();
    }, 250);
  }

  window.editDashboardMessage = function (messageId, button) {
    const message = getMessageById(messageId);
    if (!message) {
      showToast('لم يتم العثور على الرسالة المطلوبة للتعديل.');
      return;
    }

    if (button) {
      setButtonLoading(button, true, 'فتح التعديل...');
      setTimeout(() => setButtonLoading(button, false), 300);
    }

    fillMessageFormForEdit(message);
    showToast('تم فتح الرسالة للتعديل. عدّل الحقول ثم اضغط حفظ تعديل الرسالة.');
  };

  window.deleteDashboardMessage = function (messageId, button) {
    messageId = clean(messageId);
    if (!messageId) return;

    if (!confirm('هل تريد حذف هذه الرسالة من لوحة الرسائل؟')) return;

    const targetButton = button || findMessageActionButton(messageId, 'حذف');
    setButtonLoading(targetButton, true, 'جاري الحذف...');

    withTimeout(apiRequest('updateSiteMessageStatus', {
      messageId: messageId,
      message_id: messageId,
      status: DELETED_STATUS
    }), REQUEST_TIMEOUT_MS)
      .then(res => {
        if (!res || res.success === false) {
          throw new Error(res?.message || 'تعذر حذف الرسالة.');
        }

        removeDeletedMessagesFromLocalList(messageId);
        showToast(res.message || 'تم حذف الرسالة.');

        if (typeof renderSettingsTab === 'function') {
          renderSettingsTab();
        }

        refreshDashboardQuietly();
      })
      .catch(err => {
        showToast(err.message || 'تعذر حذف الرسالة.');
      })
      .finally(() => {
        setButtonLoading(targetButton, false);
      });
  };

  window.toggleDashboardMessage = function (messageId, status) {
    const targetButton = findMessageActionButton(messageId, status === 'active' ? 'تفعيل' : 'إلغاء التفعيل');
    setButtonLoading(targetButton, true, 'جاري التحديث...');

    withTimeout(apiRequest('updateSiteMessageStatus', {
      messageId: messageId,
      message_id: messageId,
      status: status
    }), REQUEST_TIMEOUT_MS)
      .then(res => {
        if (!res || res.success === false) {
          throw new Error(res?.message || 'تعذر تحديث الرسالة.');
        }

        updateLocalMessageStatus(messageId, status);
        showToast(res.message || 'تم تحديث الرسالة.');

        if (typeof renderSettingsTab === 'function') {
          renderSettingsTab();
        }

        refreshDashboardQuietly();
      })
      .catch(err => {
        showToast(err.message || 'تعذر تحديث الرسالة.');
      })
      .finally(() => {
        setButtonLoading(targetButton, false);
      });
  };

  window.saveDashboardMessage = function () {
    const saveButton = findMessageSaveButton();
    const hidden = ensureMessageEditHiddenField();
    const messageId = hidden ? clean(hidden.value) : '';
    const file = document.getElementById('msgImage')?.files?.[0];
    const martyrSelect = document.getElementById('msgMartyrId');
    const martyrId = martyrSelect?.value || '';
    const martyrName = martyrId ? (martyrSelect.options[martyrSelect.selectedIndex]?.text || '') : '';

const isEditingExistingMessage = !!String(messageId || '').trim();

const payload = {
  message_id: messageId,
  messageId: messageId,

  old_message_id: isEditingExistingMessage ? messageId : '',
  oldMessageId: isEditingExistingMessage ? messageId : '',

  rotate_message_id: isEditingExistingMessage,
  rotateMessageId: isEditingExistingMessage,

  title: document.getElementById('msgTitle')?.value || '',
  body: document.getElementById('msgBody')?.value || '',
  status: document.getElementById('msgStatus')?.value || 'active',
  sort_order: document.getElementById('msgOrder')?.value || '100',
  message_type: document.getElementById('msgType')?.value || 'notice',
  allow_reply: document.getElementById('msgAllowReply')?.checked ? 'نعم' : 'لا',
  martyr_id: martyrId,
  martyr_name: martyrName
};
    
    if (!clean(payload.title)) {
      showToast('عنوان الرسالة مطلوب.');
      return;
    }

    if (!clean(payload.body)) {
      showToast('نص الرسالة مطلوب.');
      return;
    }

    setButtonLoading(saveButton, true, messageId ? 'جاري حفظ التعديل...' : 'جاري حفظ الرسالة...');

    const finish = function () {
      return withTimeout(apiRequest('saveSiteMessage', payload), REQUEST_TIMEOUT_MS)
        .then(res => {
          if (!res || res.success === false) {
            throw new Error(res?.message || 'تعذر حفظ الرسالة.');
          }

          showToast(res.message || (messageId ? 'تم تعديل الرسالة.' : 'تم حفظ الرسالة.'));
          clearMessageFormAfterSave();
          refreshDashboardQuietly();
        })
        .catch(err => {
          showToast(err.message || 'تعذر حفظ الرسالة.');
        })
        .finally(() => {
          setButtonLoading(saveButton, false);
          updateMessageSaveButtonLabel();
        });
    };

    if (file) {
      if (typeof fileToBase64 !== 'function') {
        showToast('تعذر قراءة الصورة في المتصفح.');
        setButtonLoading(saveButton, false);
        return;
      }

      fileToBase64(file)
        .then(base64 => {
          payload.imageBase64 = base64;
          payload.imageName = file.name;
          return finish();
        })
        .catch(err => {
          showToast(err.message || 'تعذر قراءة الصورة.');
          setButtonLoading(saveButton, false);
          updateMessageSaveButtonLabel();
        });
    } else {
      finish();
    }
  };

  function patchMessagesAdminActions() {
    ensureMessageEditHiddenField();
    updateMessageSaveButtonLabel();

    const messages = getAdminMessagesList().filter(msg => clean(msg.status) !== DELETED_STATUS);
    const list = document.getElementById('messagesAdminList');
    if (!list) return;

    messages.forEach(msg => {
      const messageId = clean(msg.message_id);
      const card = findMessageCard(messageId);
      if (!card || card.dataset.taldoMessageActionsEnhanced === '1') return;

      card.dataset.taldoMessageActionsEnhanced = '1';
      card.dataset.messageId = messageId;
      card.classList.add('taldo-message-admin-card');

      const actionBox = Array.from(card.querySelectorAll('.d-flex.gap-1.flex-wrap')).pop() || card.querySelector('.d-flex.gap-1');
      if (!actionBox) return;

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'btn btn-sm btn-outline-secondary taldo-message-edit-btn';
      editButton.innerHTML = '<i class="fa-solid fa-pen-to-square ms-1"></i> تعديل';
      editButton.addEventListener('click', function () {
        window.editDashboardMessage(messageId, editButton);
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn btn-sm btn-outline-danger taldo-message-delete-btn';
      deleteButton.innerHTML = '<i class="fa-solid fa-trash ms-1"></i> حذف';
      deleteButton.addEventListener('click', function () {
        window.deleteDashboardMessage(messageId, deleteButton);
      });

      actionBox.prepend(deleteButton);
      actionBox.prepend(editButton);
    });

    Array.from(list.querySelectorAll('.taldo-message-admin-card')).forEach(card => {
      const id = clean(card.dataset.messageId);
      const msg = getMessageById(id);
      if (msg && clean(msg.status) === DELETED_STATUS) {
        card.remove();
      }
    });
  }

  function getAboutRows() {
    return Array.from(document.querySelectorAll('.taldo-about-section-admin-item'));
  }

  function setAboutRowEditing(row, editing) {
    if (!row) return;

    row.dataset.taldoAboutEditing = editing ? '1' : '0';
    row.classList.toggle('taldo-about-row-editing', !!editing);
    row.classList.toggle('taldo-about-row-locked', !editing);

    row.querySelectorAll('.taldo-about-section-title, .taldo-about-section-body').forEach(input => {
      input.readOnly = !editing;
      input.classList.toggle('taldo-about-readonly-field', !editing);
    });

    const editButton = row.querySelector('.taldo-about-edit-section-btn');
    if (editButton) {
      editButton.innerHTML = editing
        ? '<i class="fa-solid fa-lock ms-1"></i> إنهاء التعديل'
        : '<i class="fa-solid fa-pen-to-square ms-1"></i> تعديل';
      editButton.classList.toggle('btn-outline-warning', !!editing);
      editButton.classList.toggle('btn-outline-secondary', !editing);
    }
  }

  function patchAboutRowsEditButtons() {
    getAboutRows().forEach(row => {
      if (row.dataset.taldoAboutActionsEnhanced !== '1') {
        row.dataset.taldoAboutActionsEnhanced = '1';

        const removeButton = row.querySelector('.taldo-about-remove-section-btn');
        const head = row.querySelector('.taldo-about-section-admin-head');
        const editButton = document.createElement('button');

        editButton.type = 'button';
        editButton.className = 'btn btn-sm btn-outline-secondary taldo-about-edit-section-btn';
        editButton.innerHTML = '<i class="fa-solid fa-pen-to-square ms-1"></i> تعديل';
        editButton.addEventListener('click', function () {
          const willEdit = row.dataset.taldoAboutEditing !== '1';
          setAboutRowEditing(row, willEdit);

          if (willEdit) {
            const collapse = row.querySelector('.taldo-about-section-admin-collapse');
            if (collapse && typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
              bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).show();
            }

            setTimeout(() => {
              const first = row.querySelector('.taldo-about-section-title, .taldo-about-section-body');
              if (first) first.focus();
            }, 160);
          }
        });

        if (removeButton) {
          removeButton.insertAdjacentElement('beforebegin', editButton);
        } else if (head) {
          head.appendChild(editButton);
        }
      }

      if (row.dataset.taldoAboutEditing !== '1') {
        setAboutRowEditing(row, false);
      }
    });
  }

  const oldAddAboutSectionRow = window.addAboutSectionRow;
  if (typeof oldAddAboutSectionRow === 'function' && !oldAddAboutSectionRow.__taldoEditButtonWrapped) {
    window.addAboutSectionRow = function () {
      const before = getAboutRows();
      const result = oldAddAboutSectionRow.apply(this, arguments);

      setTimeout(() => {
        patchAboutRowsEditButtons();
        const after = getAboutRows();
        const newRow = after.find(row => !before.includes(row)) || after[after.length - 1];
        if (newRow) setAboutRowEditing(newRow, true);
      }, 0);

      return result;
    };

    window.addAboutSectionRow.__taldoEditButtonWrapped = true;
  }

  const oldRemoveAboutSectionRow = window.removeAboutSectionRow;
  if (typeof oldRemoveAboutSectionRow === 'function' && !oldRemoveAboutSectionRow.__taldoRemoveSpinnerWrapped) {
    window.removeAboutSectionRow = function (key) {
      const row = getAboutRows().find(item => item.dataset.rowKey === key);
      const btn = row ? row.querySelector('.taldo-about-remove-section-btn') : null;

      setButtonLoading(btn, true, 'حذف...');
      const result = oldRemoveAboutSectionRow.apply(this, arguments);

      setTimeout(() => {
        setButtonLoading(btn, false);
        patchAboutRowsEditButtons();
      }, 250);

      return result;
    };

    window.removeAboutSectionRow.__taldoRemoveSpinnerWrapped = true;
  }


  function installAboutSavePreservingMultiline() {
    if (typeof window.saveAboutUsText !== 'function') return;
    if (window.saveAboutUsText.__taldoPreserveMultilineWrapped) return;

    const oldSaveAboutUsText = window.saveAboutUsText;

    window.saveAboutUsText = function () {
      const rows = getAboutRows();
      const hasBuilder = !!rows.length;

      if (!hasBuilder) {
        return oldSaveAboutUsText.apply(this, arguments);
      }

      const sections = readAboutSectionsPreservingMultiline();

      if (!sections.length) {
        showToast('يرجى إضافة عنوان أو نص واحد على الأقل في قسم من نحن.');
        return;
      }

      const value = stringifyAboutSectionsPreservingMultiline(sections);
      const button = findAboutSaveButton();

      setAboutValueEverywhere(value);
      setButtonLoading(button, true, 'جاري حفظ قسم من نحن...');

      return withTimeout(apiRequest('updateSettingValue', {
        key: 'about_us_text',
        value: value,
        description: 'أقسام تظهر عند الضغط على زر من نحن'
      }), REQUEST_TIMEOUT_MS, 'تعذر حفظ قسم من نحن.')
        .then(res => {
          if (!res || res.success === false) {
            throw new Error(res?.message || 'تعذر حفظ قسم من نحن.');
          }

          setAboutValueEverywhere(value);
          showToast(res.message || 'تم حفظ قسم من نحن.');

          try {
            if (typeof window.taldoRenderAboutSectionsPublic === 'function') {
              window.taldoRenderAboutSectionsPublic();
              setTimeout(window.taldoRenderAboutSectionsPublic, 120);
            }
          } catch (error) {}

          patchAboutRowsEditButtons();
          return res;
        })
        .catch(err => {
          showToast(err.message || 'تعذر حفظ قسم من نحن.');
        })
        .finally(() => {
          setButtonLoading(button, false);
        });
    };

    window.saveAboutUsText.__taldoPreserveMultilineWrapped = true;

    try {
      saveAboutUsText = window.saveAboutUsText;
    } catch (error) {}
  }

  function installAboutSaveButtonSpinner() {
    const button = findAboutSaveButton();
    if (!button || button.dataset.taldoAboutSaveListener === '1') return;

    button.dataset.taldoAboutSaveListener = '1';
    button.addEventListener('click', function () {
      setButtonLoading(button, true, 'جاري حفظ قسم من نحن...');

      setTimeout(() => {
        setButtonLoading(button, false);
      }, REQUEST_TIMEOUT_MS + 1500);
    }, true);
  }

  function wrapApiRequestForButtonEvents() {
    if (typeof window.apiRequest !== 'function') return;
    if (window.apiRequest.__taldoDashboardActionsWrapped) return;

    const oldApiRequest = window.apiRequest;

    window.apiRequest = function (action, data) {
      const promise = oldApiRequest.apply(this, arguments);

      Promise.resolve(promise)
        .then(res => {
          if (action === 'updateSettingValue' && data && data.key === 'about_us_text') {
            setButtonLoading(findAboutSaveButton(), false);
          }
          return res;
        })
        .catch(error => {
          if (action === 'updateSettingValue' && data && data.key === 'about_us_text') {
            setButtonLoading(findAboutSaveButton(), false);
          }
          throw error;
        });

      return promise;
    };

    window.apiRequest.__taldoDashboardActionsWrapped = true;
  }

  function patchAllDashboardEnhancements() {
    wrapApiRequestForButtonEvents();
    installAboutSavePreservingMultiline();
    patchMessagesAdminActions();
    patchAboutRowsEditButtons();
    installAboutSaveButtonSpinner();
  }

  const previousRenderSettingsTab = window.renderSettingsTab;
  if (typeof previousRenderSettingsTab === 'function' && !previousRenderSettingsTab.__taldoDashboardActionsWrapped) {
    window.renderSettingsTab = function () {
      /*
        مهم جدًا:
        نملأ window.__adminMessages قبل استدعاء renderSettingsTab الأصلي.
        هكذا لا يعود renderSettingsTab إلى siteMessages التي تعرض الرسائل المفعلة فقط.
        ولا نطلب getAdminDashboardData من هنا حتى لا تتكرر التحديثات ولا يقفز السكرول.
      */
      hydrateAdminMessagesFromKnownSources();

      const result = previousRenderSettingsTab.apply(this, arguments);

      setTimeout(patchAllDashboardEnhancements, 0);
      setTimeout(patchAllDashboardEnhancements, 250);

      return result;
    };

    window.renderSettingsTab.__taldoDashboardActionsWrapped = true;

    try {
      renderSettingsTab = window.renderSettingsTab;
    } catch (error) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(patchAllDashboardEnhancements, 400);
  });

  setInterval(function () {
    const settingsTab = document.getElementById('dashboardSettingsTab');
    if (settingsTab && settingsTab.offsetParent !== null) {
      patchAllDashboardEnhancements();
    }
  }, 3000);
})();
