(function() {
  const EDIT_EXTRA_TYPES = [
    { value: 'تحت التعذيب', id: 'editTypeTorture' },
    { value: 'معتقل', id: 'editTypeDetained' },
    { value: 'مفقود', id: 'editTypeMissing' }
  ];

  function safeEscapeHtml(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeEscapeAttr(value) {
    if (typeof escapeAttr === 'function') return escapeAttr(value);
    return safeEscapeHtml(value).replaceAll('`', '&#096;');
  }

  function removeOldVisibleEditExtraFields() {
    const oldSecurity = document.getElementById('edit_security_branch');
    if (oldSecurity && !oldSecurity.closest('#editSecurityBranchBox')) {
      const holder = oldSecurity.closest('.col-md-6') || oldSecurity.parentElement;
      if (holder) holder.remove();
    }

    const oldLastSeen = document.getElementById('edit_last_seen_place');
    if (oldLastSeen && !oldLastSeen.closest('#editLastSeenPlaceBox')) {
      const holder = oldLastSeen.closest('.col-md-6') || oldLastSeen.parentElement;
      if (holder) holder.remove();
    }
  }

  function ensureEditMartyrdomFieldsRestored() {
    const editTypeOther = document.getElementById('editTypeOther');
    const row = editTypeOther ? editTypeOther.closest('.d-flex') : null;

    if (row) {
      const otherWrapper = editTypeOther.closest('.form-check');

      EDIT_EXTRA_TYPES.forEach(item => {
        if (document.getElementById(item.id)) return;

        const div = document.createElement('div');
        div.className = 'form-check';
        div.innerHTML = `
          <input class="form-check-input" type="radio" name="martyrdom_type" value="${safeEscapeAttr(item.value)}" id="${item.id}" required onchange="toggleEditCauseFields()">
          <label class="form-check-label" for="${item.id}">${safeEscapeHtml(item.value)}</label>
        `;

        if (otherWrapper) {
          row.insertBefore(div, otherWrapper);
        } else {
          row.appendChild(div);
        }
      });
    }

    removeOldVisibleEditExtraFields();

    const editOtherBox = document.getElementById('editOtherCauseBox');

    if (editOtherBox && !document.getElementById('editSecurityBranchBox')) {
      editOtherBox.insertAdjacentHTML('afterend', `
        <div class="col-md-6 d-none" id="editSecurityBranchBox">
          <label class="form-label fw-bold">بيانات الفرع الأمني</label>
          <input type="text" class="form-control" id="edit_security_branch" name="security_branch" placeholder="اختياري">
        </div>

        <div class="col-md-6 d-none" id="editLastSeenPlaceBox">
          <label class="form-label fw-bold">آخر مكان شوهد فيه الشهيد</label>
          <input type="text" class="form-control" id="edit_last_seen_place" name="last_seen_place" placeholder="اختياري">
        </div>
      `);
    }

    const securityInput = document.getElementById('edit_security_branch');
    const lastSeenInput = document.getElementById('edit_last_seen_place');

    if (securityInput) securityInput.setAttribute('name', 'security_branch');
    if (lastSeenInput) lastSeenInput.setAttribute('name', 'last_seen_place');
  }

  window.ensureEditMartyrdomFieldsRestored = ensureEditMartyrdomFieldsRestored;

  window.toggleEditCauseFields = function(clearHiddenValues = true) {
    ensureEditMartyrdomFieldsRestored();

    const type = document.querySelector('#editMartyrForm input[name="martyrdom_type"]:checked')?.value || '';

    const battleBox = document.getElementById('editBattleNameBox');
    const otherBox = document.getElementById('editOtherCauseBox');
    const securityBox = document.getElementById('editSecurityBranchBox');
    const lastSeenBox = document.getElementById('editLastSeenPlaceBox');

    const battleInput = document.getElementById('edit_battle_name');
    const otherInput = document.getElementById('edit_other_cause');
    const securityInput = document.getElementById('edit_security_branch');
    const lastSeenInput = document.getElementById('edit_last_seen_place');

    if (battleBox) battleBox.classList.toggle('d-none', type !== 'المعارك');
    if (otherBox) otherBox.classList.toggle('d-none', type !== 'آخر');

    if (securityBox) {
      securityBox.classList.toggle('d-none', !(type === 'تحت التعذيب' || type === 'معتقل'));
    }

    if (lastSeenBox) {
      lastSeenBox.classList.toggle('d-none', type !== 'مفقود');
    }

    if (battleInput) battleInput.required = type === 'المعارك';
    if (otherInput) otherInput.required = type === 'آخر';
    if (securityInput) securityInput.required = false;
    if (lastSeenInput) lastSeenInput.required = false;

    if (clearHiddenValues) {
      if (battleInput && type !== 'المعارك') battleInput.value = '';
      if (otherInput && type !== 'آخر') otherInput.value = '';
      if (securityInput && !(type === 'تحت التعذيب' || type === 'معتقل')) securityInput.value = '';
      if (lastSeenInput && type !== 'مفقود') lastSeenInput.value = '';
    }
  };

  try { toggleEditCauseFields = window.toggleEditCauseFields; } catch (e) {}

  window.openEditMartyrModal = function(focusField) {
    if (!currentDetailsItem) return;

    ensureEditMartyrdomFieldsRestored();

    const form = document.getElementById('editMartyrForm');
    if (form) form.reset();

    const editImageInput = document.getElementById('editImageInput');
    if (editImageInput) editImageInput.value = '';

    const idInput = document.getElementById('editMartyrId');
    if (idInput) idInput.value = currentDetailsItem.martyr_id || '';

    const fields = [
      'full_name',
      'family_name',
      'father_name',
      'birth_year',
      'nickname',
      'battle_name',
      'other_cause',
      'security_branch',
      'last_seen_place',
      'martyrdom_date',
      'martyrdom_place',
      'extra_info'
    ];

    fields.forEach(field => {
      const el = document.getElementById('edit_' + field);
      if (el) el.value = currentDetailsItem[field] || '';
    });

    const martyrdomType = String(currentDetailsItem.martyrdom_type || '').trim();

    document
      .querySelectorAll('#editMartyrForm input[name="martyrdom_type"]')
      .forEach(radio => {
        radio.checked = radio.value === martyrdomType;
      });

    window.toggleEditCauseFields(false);

    const dropdown = document.getElementById('editFamilyDropdown');
    if (dropdown) dropdown.classList.add('d-none');

    if (modals && !modals.editMartyrModal) {
      const modalEl = document.getElementById('editMartyrModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        modals.editMartyrModal = new bootstrap.Modal(modalEl);
      }
    }

    modals.editMartyrModal?.show();

    setTimeout(() => {
      const focusTarget =
        document.getElementById('edit_' + focusField) ||
        document.querySelector('#editMartyrForm input[name="martyrdom_type"]:checked') ||
        document.getElementById('edit_full_name');

      focusTarget?.focus();
    }, 250);
  };

  try { openEditMartyrModal = window.openEditMartyrModal; } catch (e) {}

  window.saveMartyrEdits = async function() {
    ensureEditMartyrdomFieldsRestored();

    const form = document.getElementById('editMartyrForm');

    if (!form || !form.checkValidity()) {
      if (form) form.reportValidity();
      return;
    }

    const martyrId = document.getElementById('editMartyrId')?.value || '';

    const payload = {
      martyr_id: martyrId
    };

    const formData = Object.fromEntries(new FormData(form).entries());
    Object.assign(payload, formData);

    if (payload.martyrdom_type !== 'المعارك') {
      payload.battle_name = '';
    }

    if (payload.martyrdom_type !== 'آخر') {
      payload.other_cause = '';
    }

    if (!(payload.martyrdom_type === 'تحت التعذيب' || payload.martyrdom_type === 'معتقل')) {
      payload.security_branch = '';
    }

    if (payload.martyrdom_type !== 'مفقود') {
      payload.last_seen_place = '';
    }

    const imageInput = document.getElementById('editImageInput');

    try {
      if (imageInput && imageInput.files && imageInput.files.length && typeof filesToPayload === 'function') {
        payload.imageFiles = await filesToPayload(imageInput.files);
      }
    } catch (error) {
      showToast(error.message || 'تعذر قراءة الصورة.');
      return;
    }

    const btn = document.getElementById('editMartyrSaveBtn');
    const normalHtml = `<i class="fa-solid fa-floppy-disk ms-1"></i> حفظ التعديلات`;

    if (typeof setButtonLoading === 'function') {
      setButtonLoading(btn, true, 'جاري الحفظ...', normalHtml);
    } else if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...`;
    }

    try {
      const res = await apiRequest('updateMartyrFields', payload);

      if (!res || res.success === false) {
        showToast(res?.message || 'تعذر الحفظ.');
        return;
      }

      if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId) {
        Object.assign(currentDetailsItem, payload, { updated_at: new Date().toISOString() });
      }

      if (typeof updateLocalMartyr === 'function') {
        updateLocalMartyr(martyrId, Object.assign({}, payload, { updated_at: new Date().toISOString() }));
      }

      if (typeof recomputeAndRenderAfterLocalMutation === 'function') {
        recomputeAndRenderAfterLocalMutation();
      }

      modals.editMartyrModal?.hide();
      showToast(res.message || 'تم حفظ التعديلات.');

      if (currentDetailsItem && currentDetailsItem.martyr_id === martyrId && typeof openMartyrDetails === 'function') {
        openMartyrDetails(martyrId, lastPageBeforeDetails || 'dashboardPage', true);
      }

      if (typeof refreshAfterMutation === 'function') {
        refreshAfterMutation();
      } else {
        if (typeof refreshDashboardData === 'function') refreshDashboardData(false);
        if (typeof loadInitialData === 'function') loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'تعذر الحفظ.');
      if (typeof refreshDashboardData === 'function') {
        try { refreshDashboardData(false, { forceFresh: true, useClientCache: false }); } catch (e) { refreshDashboardData(false); }
      }
    } finally {
      if (typeof setButtonLoading === 'function') {
        setButtonLoading(btn, false, '', normalHtml);
      } else if (btn) {
        btn.disabled = false;
        btn.innerHTML = normalHtml;
      }
    }
  };

  try { saveMartyrEdits = window.saveMartyrEdits; } catch (e) {}

  document.addEventListener('DOMContentLoaded', ensureEditMartyrdomFieldsRestored);

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    ensureEditMartyrdomFieldsRestored();
  }
})();
