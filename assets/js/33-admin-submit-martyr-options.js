(function() {
  'use strict';

  function isAdminMode() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function getSubmitForm() {
    return document.getElementById('martyrForm');
  }

  function getSubmitFooter() {
    return document.querySelector('#submitModal .modal-footer');
  }

  function getSubmitBody() {
    return document.querySelector('#submitModal .modal-body');
  }

  function setHiddenValue(name, value) {
    const form = getSubmitForm();
    if (!form) return;

    let input = form.querySelector(`input[name="${name}"]`);

    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }

    input.value = value;
  }

  function getSwitchValue(id) {
    return document.getElementById(id)?.checked ? 'نعم' : 'لا';
  }

  function syncAdminSubmitHiddenFields(publishAsVerified) {
    /*
      هذه القيم تذهب مع submitMartyr فقط عند الضغط على زر الرفع.
      لا يوجد أي طلب API عند تبديل الخيارات.
    */

    const isAdmin = isAdminMode();

    if (!isAdmin) {
      setHiddenValue('verification_status', 'بانتظار التوثيق');
      setHiddenValue('allow_updates', 'نعم');
      setHiddenValue('needs_completion', 'لا');
      setHiddenValue('is_houla_massacre', 'لا');
      setHiddenValue('isHoulaMassacre', 'لا');
      return;
    }

    const verifiedValue = publishAsVerified ? 'موثق' : 'بانتظار التوثيق';
    const allowUpdates = getSwitchValue('adminSubmitAllowUpdatesSwitch');
    const needsCompletion = getSwitchValue('adminSubmitNeedsCompletionSwitch');
    const houlaMassacre = getSwitchValue('adminSubmitHoulaMassacreSwitch');

    setHiddenValue('verification_status', verifiedValue);
    setHiddenValue('allow_updates', allowUpdates);
    setHiddenValue('needs_completion', needsCompletion);

    /*
      نرسل أكثر من اسم احتياطًا لأن المشروع يستخدم أكثر من تسمية في أماكن مختلفة.
    */
    setHiddenValue('is_houla_massacre', houlaMassacre);
    setHiddenValue('isHoulaMassacre', houlaMassacre);
    setHiddenValue('houla_massacre', houlaMassacre);
    setHiddenValue('massacre_houla', houlaMassacre);

    if (publishAsVerified) {
      setHiddenValue('reviewer_notes', 'نشره الأدمن مباشرة كموثق من مودال إضافة شهيد');
    }
  }

  function installAdminSubmitOptionsBox() {
    const body = getSubmitBody();
    const form = getSubmitForm();

    if (!body || !form || document.getElementById('adminSubmitOptionsBox')) return;

    const box = document.createElement('div');
    box.id = 'adminSubmitOptionsBox';
    box.className = 'admin-submit-options-box d-none';

    box.innerHTML = `
      <div class="alert alert-warning mb-3">
        <div class="fw-bold mb-1">
          <i class="fa-solid fa-user-shield ms-1"></i>
          خيارات الأدمن قبل رفع الاسم
        </div>
        <div class="small">
          هذه الخيارات لا تحفظ مباشرة، بل تُرسل فقط عند الضغط على زر الرفع.
        </div>
      </div>

      <div class="row g-2">
        <div class="col-md-4">
          <div class="form-check form-switch admin-submit-switch-card">
            <input class="form-check-input" type="checkbox" id="adminSubmitAllowUpdatesSwitch" checked>
            <label class="form-check-label fw-bold" for="adminSubmitAllowUpdatesSwitch">
              إظهار زر استكمال البيانات
            </label>
          </div>
        </div>

        <div class="col-md-4">
          <div class="form-check form-switch admin-submit-switch-card">
            <input class="form-check-input" type="checkbox" id="adminSubmitNeedsCompletionSwitch">
            <label class="form-check-label fw-bold" for="adminSubmitNeedsCompletionSwitch">
              إظهار علامة يحتاج استكمال
            </label>
          </div>
        </div>

        <div class="col-md-4">
          <div class="form-check form-switch admin-submit-switch-card">
            <input class="form-check-input" type="checkbox" id="adminSubmitHoulaMassacreSwitch">
            <label class="form-check-label fw-bold" for="adminSubmitHoulaMassacreSwitch">
              عرض هذا الاسم ضمن صفحة شهداء المجزرة
            </label>
          </div>
        </div>
      </div>
    `;

    form.appendChild(box);
  }

  function installPublishVerifiedButton() {
    const footer = getSubmitFooter();
    const submitBtn = document.getElementById('submitBtn');

    if (!footer || !submitBtn || document.getElementById('submitVerifiedBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'submitVerifiedBtn';
    btn.className = 'btn btn-success d-none';
    btn.onclick = function() {
      submitMartyrFormAsVerified();
    };

    btn.innerHTML = `
      <i class="fa-solid fa-circle-check ms-1"></i>
      نشر كموثق
    `;

    footer.insertBefore(btn, submitBtn);
  }

  function resetAdminSubmitOptions() {
    const allow = document.getElementById('adminSubmitAllowUpdatesSwitch');
    const needs = document.getElementById('adminSubmitNeedsCompletionSwitch');
    const houla = document.getElementById('adminSubmitHoulaMassacreSwitch');

    if (allow) allow.checked = true;
    if (needs) needs.checked = false;
    if (houla) houla.checked = false;

    syncAdminSubmitHiddenFields(false);
  }

  function updateAdminSubmitOptionsVisibility() {
    const isAdmin = isAdminMode();

    const box = document.getElementById('adminSubmitOptionsBox');
    const verifiedBtn = document.getElementById('submitVerifiedBtn');

    if (box) box.classList.toggle('d-none', !isAdmin);
    if (verifiedBtn) verifiedBtn.classList.toggle('d-none', !isAdmin);

    syncAdminSubmitHiddenFields(false);
  }

  function installAdminSubmitFeature() {
    installAdminSubmitOptionsBox();
    installPublishVerifiedButton();
    updateAdminSubmitOptionsVisibility();
  }

  /*
    نغلف زر الإرسال العادي:
    - للزائر يبقى بانتظار التوثيق.
    - للأدمن يبقى أيضًا بانتظار التوثيق إلا إذا ضغط زر "نشر كموثق".
    - خيارات الاستكمال والمجزرة تُرسل مع الطلب.
  */
  const oldSubmitMartyrForm =
    window.submitMartyrForm ||
    (typeof submitMartyrForm === 'function' ? submitMartyrForm : null);

  if (typeof oldSubmitMartyrForm === 'function' && !oldSubmitMartyrForm.__adminSubmitOptionsWrapped) {
    window.submitMartyrForm = function() {
      syncAdminSubmitHiddenFields(false);
      return oldSubmitMartyrForm.apply(this, arguments);
    };

    window.submitMartyrForm.__adminSubmitOptionsWrapped = true;

    try {
      submitMartyrForm = window.submitMartyrForm;
    } catch (e) {}
  }

  /*
    زر الأدمن الجديد: يرسل نفس الفورم، لكن بحالة موثق مباشرة.
  */
  window.submitMartyrFormAsVerified = function() {
    if (!isAdminMode()) {
      showToast('هذا الإجراء مخصص للأدمن فقط.');
      return;
    }

    syncAdminSubmitHiddenFields(true);

    if (typeof oldSubmitMartyrForm === 'function') {
      return oldSubmitMartyrForm();
    }

    if (typeof submitMartyrForm === 'function') {
      return submitMartyrForm();
    }
  };

  /*
    عند فتح مودال إضافة شهيد، نعيد الخيارات للوضع الافتراضي.
  */
  const oldContinueToSubmitModal =
    window.continueToSubmitModal ||
    (typeof continueToSubmitModal === 'function' ? continueToSubmitModal : null);

  if (typeof oldContinueToSubmitModal === 'function' && !oldContinueToSubmitModal.__adminSubmitOptionsWrapped) {
    window.continueToSubmitModal = function() {
      const result = oldContinueToSubmitModal.apply(this, arguments);

      setTimeout(function() {
        installAdminSubmitFeature();
        resetAdminSubmitOptions();
        updateAdminSubmitOptionsVisibility();
      }, 350);

      return result;
    };

    window.continueToSubmitModal.__adminSubmitOptionsWrapped = true;

    try {
      continueToSubmitModal = window.continueToSubmitModal;
    } catch (e) {}
  }

  /*
    بعد تسجيل الدخول أو الخروج نحدث ظهور الخيارات.
  */
  const oldUpdateAdminButtons =
    window.updateAdminButtons ||
    (typeof updateAdminButtons === 'function' ? updateAdminButtons : null);

  if (typeof oldUpdateAdminButtons === 'function' && !oldUpdateAdminButtons.__adminSubmitOptionsWrapped) {
    window.updateAdminButtons = function() {
      const result = oldUpdateAdminButtons.apply(this, arguments);
      installAdminSubmitFeature();
      updateAdminSubmitOptionsVisibility();
      return result;
    };

    window.updateAdminButtons.__adminSubmitOptionsWrapped = true;

    try {
      updateAdminButtons = window.updateAdminButtons;
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAdminSubmitFeature);
  } else {
    installAdminSubmitFeature();
  }

  setTimeout(installAdminSubmitFeature, 600);
})();
